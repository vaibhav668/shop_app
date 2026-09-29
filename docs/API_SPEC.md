# API Specification (V1)

Base URL: `/api/v1`. JSON only (except the image upload, which is multipart). Auth is `Authorization: Bearer <access_token>` unless an endpoint is marked **public**.
FastAPI's OpenAPI document (`/api/v1/openapi.json`) is the source of truth. Both frontends generate their types from it with `openapi-typescript`. This file describes intent and rules.

## Conventions

- **Money:** integer paise (`price_paise: 4500` means ₹45.00). Clients format it and never do arithmetic on it for display totals.
- **IDs:** UUID strings. Orders also have a human-readable `order_number`.
- **Pagination:** `?limit=20&offset=0` → `{ "items": [...], "total": 134, "limit": 20, "offset": 0 }`. The maximum `limit` is 50.
- **Timestamps:** ISO-8601 UTC.
- **Errors:** always in this shape:
  ```json
  { "error": { "code": "OUT_OF_STOCK", "message": "Amul Milk 500 ml has only 2 left.", "details": { "product_id": "...", "available": 2 } } }
  ```
  | HTTP | Codes |
  |---|---|
  | 400 | `VALIDATION_ERROR` |
  | 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_GOOGLE_TOKEN` |
  | 403 | `FORBIDDEN`, `ACCOUNT_DISABLED` |
  | 404 | `NOT_FOUND` (also used for resources that belong to another user) |
  | 409 | `OUT_OF_STOCK`, `PRODUCT_UNAVAILABLE`, `PRICE_CHANGED`, `INVALID_STATUS_TRANSITION`, `STOCK_CONFLICT`, `PAYMENT_ALREADY_PROCESSED` |
  | 422 | `NOT_SERVICEABLE`, `BELOW_MIN_ORDER`, `SHOP_CLOSED`, `PAYMENT_METHOD_DISABLED`, `PAYMENT_VERIFICATION_FAILED`, `PHONE_REQUIRED` |
  | 429 | `RATE_LIMITED` |

## Common DTOs

```ts
ProductCard   { id, name, unit_label, price_paise, mrp_paise, discount_percent, image_url, is_available, stock_hint: "IN_STOCK"|"LOW"|"OUT" }
ProductDetail = ProductCard & { description, category: {id,name,slug}, max_per_order, related: ProductCard[] }
Category      { id, name, slug, image_url }
CartLine      { product: ProductCard, quantity, line_total_paise, issue: null|"OUT_OF_STOCK"|"UNAVAILABLE"|"QUANTITY_REDUCED" }
Cart          { lines: CartLine[], item_count, subtotal_paise, delivery_fee_paise, total_paise, free_delivery_remaining_paise, min_order_remaining_paise }
Address       { id, label, recipient_name, phone, line1, line2, landmark, city, state, pincode, is_default, is_serviceable }
OrderSummary  { id, order_number, status, payment_method, payment_status, total_paise, item_count, placed_at, first_item_images: string[] }
OrderDetail   = OrderSummary & { items: OrderItem[], subtotal_paise, delivery_fee_paise, delivery_address, timeline: {status, at}[], can_cancel, cancel_reason }
PaymentSession{ provider, key_id, provider_order_id, amount_paise, currency, prefill: {name, email, contact} }
```
`stock_hint` never shows the exact stock count to customers ("Only a few left" appears when the product is `LOW`).

## Customer endpoints

### Auth & profile
| Method | Path | Body / Query | Response | Notes |
|---|---|---|---|---|
| POST | `/auth/google` **public** | `{ id_token, client: "mobile"\|"admin" }` | `{ access_token, refresh_token?, expires_in, user, is_new_user }` | For admin, the refresh token is set as an httpOnly cookie and not returned in the body. For admin, a non-ADMIN user gets 403. |
| POST | `/auth/refresh` **public** | `{ refresh_token }` or cookie | same as above | Rotates the token; reuse of an old token revokes the session |
| POST | `/auth/dev-login` **public, local/test only** | `{ email, name?, client }` | same as `/auth/google` | Only mounted when `DEV_LOGIN_ENABLED=true` in local/test |
| POST | `/auth/logout` | `{ device_token? }` | 204 | |
| GET | `/me` | | `User { id, email, name, avatar_url, phone, role, needs_onboarding }` | This is the spec's `/auth/me`; `/me` is the canonical path |
| PATCH | `/me` | `{ name?, phone? }` | `User` | |
| DELETE | `/me` | | 204 | Account deletion (required by the Play Store). Blocked while an order is active. |
| POST | `/me/devices` | `{ token, platform }` | 204 | Upsert |
| DELETE | `/me/devices/{token}` | | 204 | |

### Shop, home & catalog
| Method | Path | Notes |
|---|---|---|
| GET | `/shop` **public** | Name, is_accepting_orders, closed_message, delivery fee rules, payment methods enabled |
| GET | `/home` **public** | `{ banners, categories, featured: ProductCard[] }`. Featured = in-stock products marked featured (falls back to the shop's own ordering if none are). Banners are active and inside their schedule; a banner whose target is hidden or removed comes back with `target_type: NONE`. `popular` and `buy_again` are added with orders (Phase 7). |
| GET | `/categories` **public** | Active categories, sorted |
| GET | `/products` **public** | `?q&category_id&sort=default\|price_asc\|price_desc&in_stock_only&limit&offset` → `Page<ProductCard>`. With `q`, `default` sort means relevance. Search: every word must appear in the name or local keywords (substring); only if nothing matches, a typo-tolerant trigram match is used (`word_similarity ≥ 0.5`, words of 3+ letters). |
| GET | `/products/suggest` **public** | `?q` (1–60 chars) → up to 8 `{id, name, unit_label, image_url}`, same matching as search |
| GET | `/products/{id}` | `ProductDetail` (up to 10 related items, same category, available first) |

### Cart
| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/cart` | | `Cart` with live prices and issues |
| PUT | `/cart/items/{product_id}` | `{ quantity }` (0–50) | Sets an absolute quantity; 0 removes the line. Safe to repeat. Rejects unavailable products with `PRODUCT_UNAVAILABLE`/`OUT_OF_STOCK`, and quantities above stock. Returns `Cart`. |
| DELETE | `/cart/items/{product_id}` | | Returns `Cart` |
| DELETE | `/cart` | | Empties the cart |

### Favourites
`GET /favourites` → `Page<ProductCard>` · `PUT /favourites/{product_id}` → 204 · `DELETE /favourites/{product_id}` → 204

### Addresses
`GET /addresses` · `POST /addresses` · `PATCH /addresses/{id}` · `DELETE /addresses/{id}` · `POST /addresses/{id}/default`
The first address becomes the default automatically. Deleting the default address promotes the most recently used remaining one.

### Checkout & orders
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/checkout/quote` | `{ address_id, items: [{product_id, quantity}] }` | `{ lines, subtotal_paise, delivery_fee_paise, total_paise, issues[], payment_methods[] }`. Changes nothing. |
| POST | `/orders` | `{ address_id, payment_method, items[], idempotency_key, expected_total_paise, customer_note? }` | `201 { order: OrderDetail, payment: PaymentSession \| null }`. Returns `409 PRICE_CHANGED` with a fresh quote if the total differs from `expected_total_paise`. Repeating the same `idempotency_key` returns the original order. |
| GET | `/orders` | `?scope=active\|past&limit&offset` | `Page<OrderSummary>` |
| GET | `/orders/{id}` | | `OrderDetail` |
| POST | `/orders/{id}/cancel` | `{ reason? }` | `OrderDetail`. Allowed only in `AWAITING_PAYMENT` or `PENDING`. |

### Payments
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/payments/create` | `{ order_id }` | Retry: creates a new attempt for an `AWAITING_PAYMENT` order that hasn't expired → `PaymentSession` |
| POST | `/payments/verify` | `{ provider_order_id, provider_payment_id, signature }` | Checks the HMAC, then fetches the payment from the provider and checks the amount → `OrderDetail`. Safe to call twice. |
| POST | `/payments/webhook/razorpay` **public** | raw provider body | Verified with `X-Razorpay-Signature` against the webhook secret. Always returns 200 once the signature is valid (idempotent). |

### Notifications
`GET /notifications?limit&offset` · `POST /notifications/read-all` · `GET /notifications/unread-count`

## Admin endpoints (`/admin/*`, role ADMIN, enforced at router level)

| Area | Endpoints |
|---|---|
| Dashboard | `GET /admin/dashboard` → today's orders count, revenue (paid + delivered COD), counts by status, low-stock top 10, recent 10 orders, payments needing review · `GET /admin/orders/summary` → `{ pending_count, latest_order_at }` (polled every 15 s) |
| Orders | `GET /admin/orders?status&payment_status&q&from&to&limit&offset` (default hides `AWAITING_PAYMENT`) · `GET /admin/orders/{id}` · `PATCH /admin/orders/{id}/status { to_status, note? }` (a `note` is required when cancelling) |
| Products | `GET /admin/products?q&category_id&status=active\|inactive\|archived&low_stock&limit&offset` · `POST /admin/products` · `GET /admin/products/{id}` · `PATCH /admin/products/{id}` · `DELETE /admin/products/{id}` (archive) · `POST /admin/products/{id}/restore` |
| Inventory | `POST /admin/products/{id}/stock-adjust { delta, note? }` · `PATCH /admin/products/{id}/stock { stock, expected_stock }` · `POST /admin/inventory/bulk { updates: [{product_id, stock, expected_stock}] }` → `{ applied: [...], conflicts: [{product_id, expected, current}] }` · `GET /admin/inventory/movements?product_id&limit&offset` |
| Categories | `GET/POST /admin/categories` · `PATCH/DELETE /admin/categories/{id}` (delete only when the category is empty) · `POST /admin/categories/reorder { ids: [] }` |
| Banners | `GET/POST /admin/banners` · `PATCH/DELETE /admin/banners/{id}` · `POST /admin/banners/reorder { ids }`. A banner opens nothing, a category or a product (`target_type` + `target_id` must agree); optional `starts_at`/`ends_at` schedule. |
| Customers | `GET /admin/customers?q&limit&offset` (with order_count, total_spent_paise, last_order_at) · `GET /admin/customers/{id}` |
| Settings | `GET /admin/settings` · `PATCH /admin/settings` |
| Uploads | `POST /admin/uploads/images` (multipart `file`, ≤ 5 MB, jpeg/png/webp) → `{ url, key }` |

## Operational
`GET /health` (liveness) · `GET /health/db` (readiness).

## Rate limits (per IP + user)
`/auth/*`: 10/min · `POST /orders`: 10/min · `/payments/*`: 20/min · `/products/suggest`: 60/min · everything else: 120/min.
