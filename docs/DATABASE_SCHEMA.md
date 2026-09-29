# Database Schema (V1)

PostgreSQL 16+ (local dev runs 18). Managed with Alembic, and every change goes through a migration. Extensions: `pg_trgm` (search) and `citext` (case-insensitive email). `gen_random_uuid()` is built into PostgreSQL 13+, so `pgcrypto` isn't needed.

Conventions:
- Primary keys are `UUID DEFAULT gen_random_uuid()` unless noted otherwise.
- Every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Mutable tables also have `updated_at`.
- All timestamps are stored in UTC. The shop's "today" is calculated in `SHOP_TIMEZONE` (Asia/Kolkata).
- **Money is `BIGINT` in paise.** Column names end in `_paise`.
- Enums are PostgreSQL `ENUM` types created by migrations.
- Every foreign key has an index.

## Entity overview

```
users ─┬─< user_sessions
       ├─< device_tokens
       ├─< addresses
       ├── carts ─< cart_items >── products >── categories
       ├─< favourites >────────── products
       ├─< orders ─┬─< order_items >── products
       │           ├─< order_status_history
       │           └─< payments
       └─< notifications
products ─< inventory_movements >── orders (nullable)
banners, shop_settings (single row)
```

## Enums

| Enum | Values |
|---|---|
| `user_role` | `CUSTOMER`, `ADMIN` |
| `order_status` | `AWAITING_PAYMENT`, `PENDING`, `CONFIRMED`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED` |
| `payment_method` | `ONLINE`, `COD` |
| `payment_status` (on orders) | `PENDING`, `PAID`, `FAILED`, `REFUNDED`, `REFUND_FAILED` |
| `payment_attempt_status` (on payments) | `CREATED`, `CAPTURED`, `FAILED`, `REFUNDED`, `REFUND_FAILED` |
| `inventory_reason` | `INITIAL`, `ORDER_PLACED`, `ORDER_CANCELLED`, `MANUAL_ADJUST`, `STOCK_SET` |
| `banner_target` | `NONE`, `CATEGORY`, `PRODUCT` |

## Tables

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| google_sub | text UNIQUE NOT NULL | Google's stable user ID. Accounts are matched on this, never on email. |
| email | citext UNIQUE NOT NULL | |
| name | text NOT NULL | |
| avatar_url | text | |
| phone | text | `^[6-9]\d{9}$` (Indian mobile), set during onboarding |
| role | user_role NOT NULL DEFAULT 'CUSTOMER' | |
| is_active | bool NOT NULL DEFAULT true | |
| deleted_at | timestamptz | Account deletion: personal fields are anonymised and this is set |
| last_login_at | timestamptz | |

### user_sessions
Refresh-token sessions.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | Also sent in the access token as the `sid` claim |
| user_id | uuid FK users ON DELETE CASCADE | |
| refresh_token_hash | text UNIQUE NOT NULL | SHA-256 of the token; the raw token is never stored |
| client | session_client enum NOT NULL | `mobile` \| `admin` |
| expires_at | timestamptz NOT NULL | |
| revoked_at | timestamptz | |
| previous_token_hash | text (indexed) | The hash rotated away on the last refresh. If that old token is presented again, it has leaked, so the session is revoked. |
| last_used_at | timestamptz | |
| user_agent | text | |

### device_tokens
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users ON DELETE CASCADE | |
| token | text UNIQUE NOT NULL | FCM token |
| platform | text NOT NULL | `android` |
| last_seen_at | timestamptz NOT NULL | |

### addresses
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users ON DELETE CASCADE | |
| label | text NOT NULL | `Home`, `Work`, or custom text |
| recipient_name | text NOT NULL | |
| phone | text NOT NULL | |
| line1 | text NOT NULL | House / flat / floor |
| line2 | text | Street / area |
| landmark | text | |
| city | text NOT NULL | |
| state | text NOT NULL | |
| pincode | text NOT NULL | `CHECK (pincode ~ '^[1-9][0-9]{5}$')` |
| latitude, longitude | numeric(9,6) | Optional, reserved for later |
| is_default | bool NOT NULL DEFAULT false | |
| last_used_at | timestamptz | Set when an order is placed to it (Phase 7); picks the next default on delete |

Index: `uq_addresses_one_default_per_user` = `UNIQUE (user_id) WHERE is_default` enforces one default address per user; the service also locks the user row while changing addresses. Rows are hard-deleted, which is safe because orders keep their own copy of the address.

### categories
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text NOT NULL | |
| slug | text UNIQUE NOT NULL | |
| image_key | text | Storage key only. The API derives the URL (and thumbnail size) from the configured storage provider at response time. |
| sort_order | int NOT NULL DEFAULT 0 | |
| is_active | bool NOT NULL DEFAULT true | |

### products
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| category_id | uuid FK categories ON DELETE RESTRICT | |
| name | text NOT NULL | |
| slug | text UNIQUE NOT NULL | |
| description | text | |
| unit_label | text NOT NULL | e.g. `500 g`, `1 L`, `6 pcs` |
| price_paise | bigint NOT NULL CHECK > 0 | Selling price |
| mrp_paise | bigint NOT NULL | `CHECK (mrp_paise >= price_paise)` |
| stock_quantity | int NOT NULL DEFAULT 0 | **`CHECK (stock_quantity >= 0)`** |
| low_stock_threshold | int | NULL means use the shop default |
| max_per_order | int | NULL means no limit beyond the API's hard cap of 50 |
| is_active | bool NOT NULL DEFAULT true | Admin enable/disable |
| is_featured | bool NOT NULL DEFAULT false | Shown in the home "Fresh picks" section |
| image_key | text | Storage key only. The API derives the URL (and thumbnail size) from the configured storage provider at response time. |
| search_keywords | text | Synonyms, e.g. `doodh` for milk |
| sort_order | int NOT NULL DEFAULT 0 | |
| archived_at | timestamptz | Soft delete |

Indexes: `(category_id, is_active, sort_order)`, GIN trigram index on `(name || ' ' || coalesce(search_keywords,''))`, and a partial index on `is_featured WHERE is_featured`.

A product is *available* when `is_active AND archived_at IS NULL AND stock_quantity > 0`. The discount % is calculated when needed and not stored.

### carts / cart_items
| carts | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid UNIQUE FK users ON DELETE CASCADE | One cart per user |

| cart_items | Type | Notes |
|---|---|---|
| id | uuid PK | |
| cart_id | uuid FK carts ON DELETE CASCADE | |
| product_id | uuid FK products ON DELETE CASCADE | |
| quantity | int NOT NULL CHECK (quantity BETWEEN 1 AND 50) | |

`UNIQUE (cart_id, product_id)`. Cart items store **no price**. Prices are always read from `products` at the time they are shown.

### favourites
`PRIMARY KEY (user_id, product_id)`, both FKs with cascade, plus `created_at`.

### orders
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| order_number | bigint GENERATED ALWAYS AS IDENTITY (START 10001) UNIQUE | Shown to people as `#10042` |
| user_id | uuid FK users ON DELETE RESTRICT | |
| status | order_status NOT NULL | |
| payment_method | payment_method NOT NULL | |
| payment_status | payment_status NOT NULL | |
| subtotal_paise, delivery_fee_paise, discount_paise, total_paise | bigint NOT NULL | `CHECK (total_paise = subtotal_paise + delivery_fee_paise - discount_paise)` |
| delivery_name, delivery_phone, delivery_line1, delivery_line2, delivery_landmark, delivery_city, delivery_state, delivery_pincode | text | **Copy of the address at order time** |
| customer_note | text | Max 300 characters |
| idempotency_key | uuid NOT NULL | `UNIQUE (user_id, idempotency_key)` |
| payment_expires_at | timestamptz | For online orders only |
| cancel_reason | text | |
| cancelled_by | uuid FK users | |
| placed_at | timestamptz NOT NULL | |

Also `CHECK (subtotal_paise > 0)` and non-negative fee/discount. Indexes: `(user_id, placed_at DESC)`, `(status, placed_at DESC)`, and a partial index `(payment_expires_at) WHERE status = 'AWAITING_PAYMENT'`.

### order_items
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK orders ON DELETE CASCADE | |
| product_id | uuid FK products ON DELETE RESTRICT | |
| position | int NOT NULL | Line order as the customer saw it |
| product_name, unit_label | text NOT NULL | Copied at order time |
| image_key | text | Storage key copied at order time; the URL is built when shown |
| unit_price_paise, mrp_paise | bigint NOT NULL | Copied at order time |
| quantity | int NOT NULL CHECK > 0 | |
| line_total_paise | bigint NOT NULL | `CHECK (line_total_paise = unit_price_paise * quantity)` |

### order_status_history
`id`, `order_id` FK, `position` (tie-breaker within one transaction), `from_status` (nullable), `to_status`, `actor_user_id` (nullable = system), `note`, `created_at`. Index on `(order_id, created_at)`. This table drives the timestamps on the customer timeline.

### payments
One row per payment attempt, so an order can have several.
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK orders | |
| provider | text NOT NULL | `razorpay`, `fake` |
| provider_order_id | text UNIQUE NOT NULL | |
| provider_payment_id | text UNIQUE | |
| amount_paise | bigint NOT NULL | Copied from `orders.total_paise` when the attempt is created |
| currency | char(3) NOT NULL DEFAULT 'INR' | |
| status | payment_attempt_status NOT NULL | |
| method | text | `upi`, `card`, … as reported by the provider |
| failure_reason | text | |
| refund_id | text | |
| verified_at | timestamptz | |
| needs_review | bool NOT NULL DEFAULT false | Set for a late capture after expiry, or a refund failure |

### inventory_movements (append-only)
`id`, `product_id` FK, `delta` int, `resulting_stock` int, `reason` inventory_reason, `order_id` FK nullable, `actor_user_id` FK nullable, `note`, `created_at`. Index on `(product_id, created_at DESC)`.

### notifications
`id`, `user_id` FK, `type` text (e.g. `ORDER_STATUS`), `title`, `body`, `data` jsonb (`{order_id, route}`), `read_at`, `created_at`. Index on `(user_id, created_at DESC)`.

### banners
`id`, `title`, `subtitle`, `image_key`, `target_type` banner_target, `target_id` uuid, `sort_order`, `is_active`, `starts_at`, `ends_at`.

### shop_settings (single row)
| Column | Type | Default |
|---|---|---|
| id | smallint PK `CHECK (id = 1)` | 1 |
| shop_name, shop_phone, shop_address | text | |
| is_accepting_orders | bool | true |
| closed_message | text | "We're closed right now. Back tomorrow at 8 AM." |
| delivery_fee_paise | bigint | 2000 (₹20) |
| free_delivery_above_paise | bigint | 29900 (₹299) |
| min_order_paise | bigint | 9900 (₹99) |
| serviceable_pincodes | text[] | `{}`. An empty list accepts every pincode only when `APP_ENV` is local/test; in staging/production it means no delivery anywhere until the shop sets its area. |
| cod_enabled, online_payment_enabled | bool | true, true |
| payment_timeout_minutes | int | 15 |
| default_low_stock_threshold | int | 5 |

The numbers above are placeholders until the shopkeeper confirms them (see Decisions in PROJECT_PLAN).

## Critical transactions

**Place order** (`OrderService.place_order`, one transaction, READ COMMITTED + row locks):
```sql
-- idempotency: return the existing order if (user_id, idempotency_key) already exists
SELECT * FROM products WHERE id = ANY(:ids) ORDER BY id FOR UPDATE;
-- validate availability, limits and serviceability; compute totals (PricingService)
UPDATE products SET stock_quantity = stock_quantity - :q, updated_at = now() WHERE id = :id;  -- per item
INSERT INTO inventory_movements (...);  -- per item
INSERT INTO orders (...); INSERT INTO order_items (...); INSERT INTO order_status_history (...);
DELETE FROM cart_items WHERE cart_id = :cart AND product_id = ANY(:ids);
COMMIT;
```
The payment provider is called **after** commit, so a network request never holds row locks.

**Cancel / expire:** lock the order `FOR UPDATE`, check the transition, add stock back (`+ qty`), write `ORDER_CANCELLED` movements, update status and history, then commit. If the order was paid, the refund is issued after commit.

**Admin atomic adjust:**
```sql
UPDATE products SET stock_quantity = stock_quantity + :delta
WHERE id = :id AND stock_quantity + :delta >= 0 RETURNING stock_quantity;
```

**Admin set with conflict detection:**
```sql
UPDATE products SET stock_quantity = :new WHERE id = :id AND stock_quantity = :expected RETURNING stock_quantity;
-- 0 rows → conflict, report the current value
```

## Future tables (not in V1)
`coupons`, `coupon_redemptions`, `offers`, `reviews`, `delivery_zones`, `delivery_slots`, `invoices`. The `discount_paise` column on orders is already there for coupons.
