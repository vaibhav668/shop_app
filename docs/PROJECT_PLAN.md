# Project Plan — Local Grocery Shop Platform

> Status: **Planning (Phase 0 not started)** · Last updated: 2026-09-29
>
> This is the master document. Deeper detail lives in:
> [ARCHITECTURE.md](ARCHITECTURE.md) · [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) · [API_SPEC.md](API_SPEC.md) · [UI_SYSTEM.md](UI_SYSTEM.md) · [DEVELOPMENT_PHASES.md](DEVELOPMENT_PHASES.md)

---

## 1. Product overview

A grocery ordering platform for **one local shop**. It has three parts:

| Part | Who uses it | What it is |
|---|---|---|
| **Customer app** | Shoppers | Android app (React Native + Expo). Browse, search, add to cart, pay, track order. |
| **Admin dashboard** | Shopkeeper (and staff) | Web app (React + TS). Take orders, update stock, manage products. |
| **Backend API** | Both apps | FastAPI + PostgreSQL. The only source of truth for prices, stock, orders and payments. |

The shopkeeper delivers orders themselves. The app does not route drivers, track GPS, or run a marketplace.

Core loop:

```
Customer: open app → find products → cart → address → pay (or COD) → place order
Shop:     new order alert → accept → prepare → out for delivery → delivered
Customer: sees each status change (push notification + timeline)
```

## 2. Goals

1. **Reliable commerce.** Stock is never oversold, totals are always calculated by the server, and payments are always verified by the server.
2. **Fast for customers.** Home screen is useful within about 1 second on a mid-range Android phone with a warm cache. Search responds while typing. Cart changes show instantly.
3. **Fast for the shopkeeper.** Updating the stock of 20 products takes under a minute (Quick Stock mode). Moving an order to its next status takes one click.
4. **Looks like a real product.** A warm "Fresh Market" identity, with no generic AI-SaaS styling (see [UI_SYSTEM.md](UI_SYSTEM.md)).
5. **Ready for the Play Store.** Package name, signing, privacy policy, data-safety answers and account deletion are planned from day one.
6. **Maintainable by a small team.** Few dependencies, clear layers, typed API contracts and migrations under version control.

## 3. Non-goals (V1)

- Delivery partner apps, GPS tracking, route optimisation, fleet management
- Multi-vendor or multi-store support
- Password, OTP or phone login (Google Sign-In only)
- Coupons, reviews, loyalty, wallets, subscriptions (the schema leaves room for them)
- Products sold by variable weight (e.g. "0.73 kg tomatoes"). V1 sells fixed packs such as "500 g" or "1 kg"
- iOS release (Expo keeps it possible later)
- Dark mode (V1 is light-only by design)
- Real-time sockets. V1 uses push notifications plus polling while a screen is focused
- Hindi or other languages (strings are kept centralised so this can be added later)

## 4. User types

| Role | Access | How they get it |
|---|---|---|
| `CUSTOMER` | Customer app, own data only | Default on first Google sign-in |
| `ADMIN` | Admin dashboard + all `/admin/*` APIs | Promoted with a backend CLI command (`python -m app.cli make-admin <email>`). Admin rights are never granted from the client. |

The role is checked by the **backend on every admin request**. Route guards in the admin frontend only affect what the UI shows.

## 5. Customer user journey

```
Splash ─► (has session?) ──yes──► Home
            │no
            ▼
         Welcome ─► "Continue with Google" ─► verifying… ─┬─► failure screen (retry)
                                                          ▼
                                            first time? ─► Onboarding (name + phone for delivery)
                                                          ▼
                                                         Home
Home ─► Category / Search ─► Product detail ─► Add to cart
     ─► Bottom cart bar ("3 items · ₹245 → View cart")
Cart ─► Checkout: address → summary (server quote) → payment method → Place order
     ─► ONLINE: Razorpay sheet → server verifies → Order confirmed screen
     ─► COD: Order placed screen
Orders tab ─► Active order timeline (Placed → Confirmed → Preparing → Out for delivery → Delivered)
Account ─► profile, addresses, favourites, notifications, settings, logout, delete account
```

## 6. Admin user journey

```
Sign in with Google (must be ADMIN) ─► Dashboard (today at a glance)
New order chime + badge ─► Orders ─► open order ─► Accept ─► Preparing ─► Out for delivery ─► Delivered
Morning routine ─► Inventory ─► Quick Stock mode ─► type counts, Enter moves to next row ─► Save
New product ─► Products ─► Add ─► photo, name, unit, price, MRP, stock, category ─► Save
Settings ─► delivery fee, free-delivery threshold, minimum order, serviceable pincodes, "accepting orders" switch
```

## 7. Complete feature list

**Customer app**
- Auth: splash, welcome, Google sign-in, loading and failure states, onboarding (name + phone), logout, delete account
- Home: greeting, delivery address chip, search entry, categories grid, promo banners (from the database), featured products, popular products, "Buy again" (when there is order history)
- Search: debounced suggestions, recent searches stored on the device, category filter chips, paginated results, no-results state
- Categories: list and paginated products per category, all from the database
- Product detail: image, name, unit, price, MRP, discount %, availability, description, quantity stepper, add to cart, related products, "Out of stock" state
- Cart: server-side cart with optimistic updates, +/−, remove, subtotal, delivery fee, total, warnings for unavailable items, sticky bottom cart bar across screens
- Checkout: address select/add, server-calculated quote, payment method (Online / Cash on Delivery), place order, price-changed handling
- Payments: Razorpay checkout, server-side verification, retry payment, handling of payment timeouts
- Orders: active and past lists, detail with items/amount/payment status, status timeline, cancel while `PENDING`
- Favourites: heart toggle, favourites list
- Addresses: add, edit, delete, set default, pincode serviceability check
- Notifications: push on status change, in-app notification list
- UX states on every screen: loading (skeletons), empty, error, offline

**Admin dashboard**
- Sign-in (Google, ADMIN only)
- Dashboard: today's orders, today's revenue, pending, preparing, delivered, low-stock list, recent orders, "accepting orders" switch
- Orders: filterable table, detail drawer, one-click next status, cancel with reason, new-order sound and badge
- Inventory: search, category filter, +/− buttons, direct edit, enable/disable, low-stock indicator, movement history
- Quick Stock mode: keyboard-driven bulk stock entry with conflict detection
- Products: create/edit/archive, image upload, price/MRP/unit/category/description, featured flag
- Categories: create/edit/reorder/hide, image
- Banners: create/edit/schedule home promotions
- Customers: list, order count, total spend, detail
- Settings: shop info, delivery rules, payment methods enabled, default low-stock threshold

## 8. Technology stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile | React Native, **Expo** (latest stable SDK), **Expo Router**, TypeScript | Needs an EAS **development build** because Google Sign-In and Razorpay are native modules. Expo Go will not work. |
| Mobile data/state | **TanStack Query** + React Context | See §9.3 |
| Mobile UI | React Native `StyleSheet` + theme tokens, `expo-image`, Reanimated, `lucide-react-native`, Inter via `@expo-google-fonts/inter` | No UI kit, so the design stays our own |
| Admin | **Vite + React + TypeScript**, React Router, TanStack Query, CSS Modules + CSS variables, Radix primitives (dialog/select/dropdown), `react-hook-form` + `zod` | Web app with no SSR |
| Backend | Python, **FastAPI**, **SQLAlchemy 2.0 (sync, psycopg 3)**, **Alembic**, **Pydantic v2**, `pydantic-settings` | Sync SQLAlchemy is simpler and fast enough for one shop (see ARCHITECTURE §3) |
| Database | **PostgreSQL 16+** (`pg_trgm` extension for search) | Installed locally (PostgreSQL 18 service), managed in production |
| Auth | Google ID token → backend verifies with `google-auth` → backend issues its own JWT access token + rotating refresh token | |
| Payments | `PaymentProvider` interface; **Razorpay** first; `FakeProvider` for dev/tests | Uses plain `httpx` and HMAC, not the Razorpay SDK |
| Images | `StorageProvider` interface; **Cloudinary** first; S3-compatible option; local-disk option for dev | |
| Push | **Firebase Cloud Messaging** (`firebase-admin` on the server, `expo-notifications` device token on the app) | |
| Contracts | FastAPI OpenAPI → `openapi-typescript` generates TS types for both frontends | One source of truth for API shapes |
| Tooling | `ruff`, `pytest`, `tsc`, ESLint, Jest (mobile), Vitest (admin), GitHub Actions | |
| Local Python env | Conda env **`yolo_cuda`** (per the user's instruction) | Python 3.10 locally. Code stays 3.10-compatible; production image (Phase 12) pins its own Python |

## 9. Architecture

Full detail: [ARCHITECTURE.md](ARCHITECTURE.md).

```
┌──────────────────┐      HTTPS/JSON       ┌──────────────────────────────┐      ┌──────────────┐
│ Android app      │ ───────────────────►  │ FastAPI (/api/v1)            │ ───► │ PostgreSQL   │
│ Expo + RN        │ ◄── FCM push ──┐      │ routers → services → repos   │      └──────────────┘
└──────────────────┘                │      │                              │ ───► Cloudinary / S3 (images)
┌──────────────────┐                └───── │ NotificationService (FCM)    │ ───► Firebase (FCM)
│ Admin web (Vite) │ ───────────────────►  │ PaymentService ─► Provider   │ ◄──► Razorpay (+ webhook)
└──────────────────┘                       └──────────────────────────────┘
        ▲                                                ▲
        └──── Google Sign-In (ID token) ────────────────┘ verified with Google's public keys
```

### 9.1 Backend layers
`routers` (HTTP only) → `services` (business rules, transactions) → `repositories` (SQLAlchemy queries) → `models`. External systems (payments, storage, push, Google) sit behind small interfaces in `app/integrations/`. Services never import a concrete provider. They receive one through dependency injection.

### 9.2 One owner for each business rule
- Prices and totals: `PricingService` only (used by the cart, the checkout quote and order creation)
- Stock changes: `InventoryService` only (orders, cancellations and admin edits all go through it and write `inventory_movements`)
- Order status changes: `OrderStateMachine` only (customer cancel, admin actions, payment events, expiry job)

### 9.3 State management (mobile)
- **Server state** (catalog, cart, orders, addresses, favourites) → **TanStack Query**. It covers caching, pagination (`useInfiniteQuery`), background refetch, retries and **optimistic cart updates with rollback**. Writing this by hand would mean building a worse version of the same thing.
- **Session state** (tokens, current user) → a small `AuthProvider` React Context. Tokens are stored in `expo-secure-store`.
- **Device-local preferences** (recent searches) → `AsyncStorage`.
- No Redux or Zustand. The cart is server state, so it belongs in the query cache. Adding a second store would mean keeping two copies in sync. The admin app uses the same approach.

## 10. Folder structure

```
shop_app/
├── backend/
│   ├── app/
│   │   ├── main.py                # app factory, router mounting, middleware
│   │   ├── cli.py                 # make-admin, seed-dev
│   │   ├── core/                  # config.py, database.py, security.py, errors.py, logging.py
│   │   ├── models/                # SQLAlchemy models (one file per aggregate)
│   │   ├── schemas/               # Pydantic request/response models
│   │   ├── repositories/          # DB queries
│   │   ├── services/              # auth, pricing, cart, order, order_state, inventory, payment, notification, catalog, search
│   │   ├── integrations/          # google_auth.py, payments/{base,razorpay,fake}.py, storage/{base,cloudinary,s3,local}.py, push/{base,fcm,fake}.py
│   │   ├── routers/               # auth, me, catalog, cart, addresses, checkout, orders, payments, favourites, notifications
│   │   │   └── admin/             # dashboard, orders, products, inventory, categories, banners, customers, settings, uploads
│   │   ├── dependencies/          # get_db, get_current_user, require_admin, providers
│   │   ├── jobs/                  # payment_expiry.py
│   │   └── utils/
│   ├── alembic/ + alembic.ini
│   ├── tests/                     # unit/, api/, concurrency/
│   ├── pyproject.toml / requirements.txt
│   ├── scripts/create_local_db.sql
│   └── .env.example
├── mobile/
│   ├── app/                       # Expo Router routes (see ARCHITECTURE §5)
│   ├── src/
│   │   ├── api/                   # client.ts, schema.ts (generated), per-domain hooks
│   │   ├── features/              # auth, catalog, search, cart, checkout, orders, account
│   │   ├── components/ui/         # Text, Button, Skeleton, EmptyState, ErrorState, QuantityStepper, ...
│   │   ├── theme/                 # tokens.ts, typography.ts
│   │   └── lib/                   # money.ts, storage.ts, network.ts
│   ├── assets/                    # icon, adaptive icon, splash, fonts
│   ├── app.config.ts, eas.json
│   └── .env.example
├── admin/
│   ├── src/{api,features,components,styles,routes}
│   ├── index.html, vite.config.ts
│   └── .env.example
├── docs/                          # this folder
├── .github/workflows/ci.yml
└── .gitignore
```

## 11. Database architecture

Full DDL-level spec: [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

**V1 tables (17):** `users`, `user_sessions`, `device_tokens`, `addresses`, `categories`, `products`, `carts`, `cart_items`, `favourites`, `orders`, `order_items`, `order_status_history`, `payments`, `inventory_movements`, `notifications`, `banners`, `shop_settings`.

Key decisions:
- **Money is stored as integer paise** (`BIGINT`). There are no floats anywhere, and the API returns paise.
- **UUID primary keys** throughout. Orders also get a short sequential `order_number` (e.g. `#10042`) that the shopkeeper can read aloud.
- **Orders copy product and address details at checkout.** `order_items` stores the name, unit, price and MRP at that moment, and `orders` stores the delivery address. Later edits to products or addresses never change a past order.
- **The database itself enforces safety:** `CHECK (stock_quantity >= 0)`, `CHECK (mrp_paise >= price_paise)`, `CHECK (quantity > 0)`, a unique `(user_id, idempotency_key)` on orders, one default address per user (partial unique index), and a single-row `shop_settings`.
- `inventory_movements` (listed in the brief as a future table) is **included in V1**. Stock is the shop's most important data, and this append-only log is the only way to answer "why is milk at 3?".

## 12. API architecture

Full spec: [API_SPEC.md](API_SPEC.md). REST under `/api/v1`, JSON, JWT bearer auth.

Changes from the brief's example endpoints:
- **Cart lines are addressed by `product_id`**: `PUT /cart/items/{product_id}` with `{quantity}` (0 removes the line). Because repeating the call gives the same result, optimistic updates and retries are safe, and the client never tracks cart-item IDs.
- **`POST /checkout/quote`** returns the authoritative totals before the order is placed.
- **`POST /orders`** accepts `{address_id, payment_method, items[{product_id, quantity}], idempotency_key, expected_total_paise}`. It returns the order and, for online payment, the Razorpay session inline. `POST /payments/create` is kept for **retrying** a payment.
- **`POST /payments/webhook/razorpay`** is a second, independent path for payment confirmation (covers the app being killed mid-payment).
- **`GET /home`** returns banners, categories, featured, popular and buy-again in one round trip, for a fast first paint.
- **Inventory** is split into `POST …/stock-adjust` (+/− delta, applied atomically), `PATCH …/stock` (set to a value with `expected_stock`), and `POST /admin/inventory/bulk` (Quick Stock).
- `DELETE /admin/products/{id}` **archives** the product rather than deleting it (past orders still reference it).
- Every error uses one format: `{"error": {"code": "OUT_OF_STOCK", "message": "...", "details": {...}}}`.

## 13. Authentication flow

```
App: GoogleSignin.signIn() ── configured with webClientId ──► Google returns ID token (JWT, aud = web client id)
App ──► POST /auth/google {id_token}
API: google.oauth2.id_token.verify_oauth2_token(token, audience ∈ GOOGLE_ALLOWED_CLIENT_IDS)
     check iss ∈ {accounts.google.com, https://accounts.google.com}, exp, email_verified == true
     find user by google_sub (else create CUSTOMER) ; update name/avatar/last_login_at
     issue access JWT (HS256, 15 min, claims: sub, role, sid) + refresh token (random 256-bit, stored as SHA-256 hash in user_sessions, 60 days)
App: stores both in expo-secure-store → GET /me → onboarding if phone missing → Home
Refresh: POST /auth/refresh {refresh_token} → rotate (old one revoked, new one issued). If a revoked token is reused, the whole session is revoked.
Logout: POST /auth/logout → session revoked, device token removed.
Admin web: Google Identity Services button → same /auth/google → role must be ADMIN (403 otherwise).
           Access token is kept in memory. Refresh token is set as an httpOnly, Secure, SameSite=Strict cookie scoped to /api/v1/auth.
```

## 14. Payment flow

```
1. POST /orders (payment_method=ONLINE)
   → one DB transaction: validate, lock products, deduct stock, create order(status=AWAITING_PAYMENT, payment_expires_at=now+15m)
   → commit, then PaymentService.create_session() → Razorpay order (amount = server total) → payments row (CREATED)
   → response: order + {provider, key_id, provider_order_id, amount_paise, currency}
2. App opens Razorpay checkout with those values → customer pays (UPI/card/netbanking)
3. App → POST /payments/verify {provider_order_id, provider_payment_id, signature}
   API: HMAC-SHA256(order_id|payment_id, key_secret) == signature   (proves authenticity)
        + fetch payment from Razorpay API: status=captured AND amount == payments.amount_paise   (proves settlement)
        → payments CAPTURED, order AWAITING_PAYMENT → PENDING, notify shop
4. Webhook payment.captured / payment.failed → signature verified with webhook secret → same idempotent handler
5. No success within 15 min → expiry job: order → CANCELLED (reason PAYMENT_TIMEOUT), stock restored
   Late capture after expiry → automatic refund + payment flagged for admin review
```
The client's "success" callback **never** marks anything as paid on its own. Cash on Delivery skips steps 1b–5: the order starts at `PENDING` with `payment_status=PENDING`, and becomes `PAID` when marked `DELIVERED`.

## 15. Inventory flow

- `stock_quantity` means **units available to sell**. Stock is taken out **when the order is placed** (it acts as a reservation) and put back if the order is cancelled or expires.
- Order placement runs in **one transaction**:
  1. `SELECT … FROM products WHERE id = ANY(:ids) ORDER BY id FOR UPDATE` locks the rows, always in the same order, so two transactions cannot deadlock
  2. validate `is_active`, not archived, `stock_quantity >= qty`, `qty <= max_per_order`
  3. `UPDATE products SET stock_quantity = stock_quantity - :qty` and insert an `inventory_movements` row (`ORDER_PLACED`)
  4. insert order, items and status history → commit
  The `CHECK (stock_quantity >= 0)` constraint is a final safety net.
- Admin +/− runs `UPDATE … SET stock = stock + :delta WHERE stock + :delta >= 0` in a single statement.
- Admin "set to N" (direct edit and Quick Stock) sends `expected_stock`. If the value changed since the page loaded (an order came in), that row comes back as a **conflict** and the UI asks: "Milk changed 24 → 22 because of a new order. Keep 24 / Use 22?".
- A product is marked low-stock when `stock ≤ low_stock_threshold` (per product, falling back to the shop default).
- **Test:** 20 threads race to buy the last 5 units → exactly 5 succeed and stock ends at 0.

## 16. Order lifecycle

```
                 (online only)
 AWAITING_PAYMENT ──payment verified──► PENDING ──admin accept──► CONFIRMED ──► PREPARING ──► OUT_FOR_DELIVERY ──► DELIVERED
        │                                  │                          │              │               │
        └─ timeout / customer cancel ─► CANCELLED ◄── customer (PENDING only) or admin (any non-terminal, reason required)
```
- `AWAITING_PAYMENT` is **added** to the brief's status list. Without it, the shopkeeper would see unpaid online orders among real ones. It is hidden from the admin's default order view.
- Only the transitions shown are allowed, enforced in `OrderStateMachine` with a unit test for every edge.
- Every transition writes `order_status_history` (the timeline shows the time of each step), sends a push notification to the customer, and restores stock when it moves to `CANCELLED`.
- Cancelling a paid online order calls `PaymentProvider.refund()` → `payment_status=REFUNDED` (or `REFUND_FAILED`, flagged on the dashboard).
- Customer timeline shows: Placed → Confirmed → Preparing → Out for delivery → Delivered. Completed steps are green and future steps are grey.

## 17. Notification architecture

- The app gets its native FCM token (`expo-notifications.getDevicePushTokenAsync`) → `POST /me/devices`. A user can have several devices.
- `NotificationService.notify(user, type, title, body, data)` writes a `notifications` row and then sends the push via `PushProvider` (FCM through `firebase-admin`, or a fake provider in dev/tests). It runs **after the DB commit** as a FastAPI background task. A failed push never rolls back an order. Tokens that FCM reports as invalid are deleted.
- Triggers: order placed/confirmed/preparing/out for delivery/delivered/cancelled, payment failed, refund issued.
- Tapping a notification opens `/orders/{id}` via `data.route`.
- **Shopkeeper new-order alert (V1):** the admin dashboard polls `GET /admin/orders/summary` every 15 s while open, plays a chime, and shows a badge and tab-title count. Web push or an admin mobile app comes later.

## 18. Admin architecture

- Single-page Vite app deployed as static files. It calls the same API under `/api/v1/admin/*`.
- Layout: a 220 px left sidebar (Dashboard, Orders, Inventory, Products, Categories, Customers, Settings) and a content area. On tablets the sidebar collapses to icons.
- Tables are plain semantic `<table>` elements with server-side pagination, search and filters in the URL query string (so pages can be bookmarked and survive a refresh).
- **Quick Stock mode** (`/inventory/quick`): a dense list of name, unit, current stock and a number input. Changed rows are highlighted, Enter or ↓ moves to the next row, the header shows "6 changes", and there is a single Save button. Leaving with unsaved changes asks for confirmation. Saving sends one bulk call and handles conflicts row by row.
- Product images: upload through the backend (`POST /admin/uploads/images`, max 5 MB, JPEG/PNG/WebP, validated with Pillow) → StorageProvider → returns `{url, key}`.

## 19. UI/UX design system

Full spec: [UI_SYSTEM.md](UI_SYSTEM.md). Summary:
- The "Fresh Market" palette from the brief, plus a few derived tints. No purple, indigo, navy or blue anywhere, including links, focus rings and charts.
- **Accessibility adjustment:** white text on `#16A34A` has a contrast ratio of 3.3:1, which fails WCAG AA for normal-size text. Filled buttons and green text therefore use `#15803D` (5.1:1). `#16A34A` stays the brand colour for icons, active states, the progress timeline and large surfaces. Orange is never used behind white text; offers use a light amber tint with dark amber text.
- Inter; sizes 12/13/14/16/18/22/28; tabular numbers for prices.
- Borders come before shadows. Card radius 12, sheet radius 16, controls 10. Pill shapes are only used for chips and badges.
- Motion only where it gives feedback: add-to-cart → stepper morph, cart bar slide-in, quantity tick, timeline step fill, success check. Durations 150–250 ms, and system "reduce motion" is respected.
- Copy is short and warm ("Your cart is waiting for something good.").

## 20. Security considerations

- Google ID token verified on the server (signature, `aud`, `iss`, `exp`, `email_verified`). The backend issues short-lived JWTs and rotating refresh tokens (stored hashed).
- `require_admin` dependency on the whole admin router, plus a test that calls **every** admin route as a customer and expects 403.
- Ownership checks on every customer resource (`WHERE user_id = :me`). Returns 404 instead of 403 so it doesn't reveal what exists.
- The server computes all prices and totals. The client sends only product IDs and quantities. `expected_total_paise` is used only to *detect* price changes, never as the amount charged.
- Payments: HMAC verification, amount cross-check against the stored payment, webhook signature check, idempotent handlers.
- Pydantic validation with strict limits (quantity 1–50, string lengths, pincode regex, phone regex).
- Secrets only in environment variables; `.env` is git-ignored; `.env.example` holds placeholders. `EXPO_PUBLIC_*` values end up inside the app bundle, so they must be public identifiers only.
- CORS allows only the admin origin. HTTPS only in production. Security headers are set.
- Rate limiting (`slowapi`) on `/auth/*`, `/orders` and `/payments/*`.
- Image uploads: type sniffing, size limit, re-encoding, random keys.
- Logs never contain tokens, full phone numbers or payment payload secrets.
- Account deletion endpoint (required by the Play Store): personal data is anonymised, and order records are kept for accounting.

## 21. Performance strategy

- `GET /home` returns everything the home screen needs in one call. Responses stay small (list endpoints return `ProductCard` DTOs, not full products).
- Offset pagination (page size 20) with `useInfiniteQuery` and `FlashList`/`FlatList` virtualisation. The catalog is small (a few thousand products), so offset paging is enough.
- Search uses a `pg_trgm` GIN index on `name` + `search_keywords` (e.g. "doodh" finds milk), 200 ms debounce, a suggestion endpoint limited to 8 results, and previous results stay visible while the next ones load.
- Images: Cloudinary transformations serve thumbnails at 2× the display size in WebP/AVIF. `expo-image` handles memory and disk caching with a blurhash placeholder.
- TanStack Query cache persisted for the catalog, sensible `staleTime` per query (categories 10 min, products 1 min, cart 0).
- Optimistic cart updates with rollback and per-product debounced writes (quickly pressing + five times sends one request).
- `React.memo` product cards, stable callbacks, no inline-object props in lists.
- Database indexes on every foreign key and filter column (see schema). `EXPLAIN` checks on the home and search queries.

## 22. Testing strategy

| Layer | Tooling | Must-have coverage |
|---|---|---|
| Backend unit | pytest | pricing, state machine (every allowed and forbidden transition), Razorpay signature verification, token rotation |
| Backend API | pytest + FastAPI TestClient against **real Postgres** (local `shop_test` DB, transaction rollback per test) | auth (Google verifier mocked), catalog, cart, checkout quote, order creation, cancellation restock, payments verify + webhook idempotency, admin authorization sweep, inventory bulk conflicts |
| Concurrency | pytest + threads on real Postgres | last-unit race, double-submit idempotency, webhook + verify arriving together |
| Mobile | Jest + React Native Testing Library | cart optimistic update + rollback, checkout price-change flow, auth gate routing, UX states |
| Admin | Vitest + RTL | Quick Stock editing/conflicts, order status buttons |
| E2E (Phase 11) | Maestro (Android) with a test-only auth bypass that is compiled out of production builds | browse → cart → COD order → admin delivers → customer sees Delivered |
| CI | GitHub Actions | ruff, pytest (Postgres service), `tsc --noEmit`, ESLint, Jest, Vitest on every push |

SQLite is **not** used for tests, because row locking and CHECK behaviour must match production.

## 23. Deployment architecture

```
Play Store ── Android app (EAS production build, AAB)
                     │ HTTPS
                     ▼
        api.<shopdomain>  →  FastAPI container (Docker, gunicorn+uvicorn workers)  →  Managed PostgreSQL
                     │                                                   ↘ Cloudinary, Firebase, Razorpay
admin.<shopdomain>  →  static hosting (Vercel / Netlify / Cloudflare Pages)
```
- Environments: `local` (installed PostgreSQL; **all development until Phase 12 runs locally, no Docker**), `staging` and `production` (both set up in Phase 12). The Dockerfile is written in Phase 12.
- Backend host: any container platform (Render / Railway / Fly.io / Cloud Run) with a managed Postgres **in or near India** (Mumbai/Singapore). This is a decision to make (see §Decisions).
- Migrations run as a release step (`alembic upgrade head`) before the new version takes traffic. Migrations are always additive, never destructive, within a release.
- Health checks: `/health` (process) and `/health/db`.
- Error tracking (Sentry free tier, optional) plus structured JSON logs.
- Daily database backups (from the managed provider), with a restore tested once before launch.
- The payment-expiry job runs inside the app process, guarded by a Postgres advisory lock so only one instance runs it.

## 24. Play Store release plan

| Item | Plan |
|---|---|
| Package name | `in.<shopslug>.app`. This is permanent once published, so it must be decided before the first EAS build. |
| Icon / splash | Adaptive icon (foreground + `#FAFAF7` background), monochrome icon for Android 13 themed icons, splash via `expo-splash-screen` |
| Permissions | `INTERNET`, `POST_NOTIFICATIONS` only. No location in V1. Unused defaults are removed with `android.blockedPermissions`. |
| Signing | EAS-managed upload key + Play App Signing. **Register both SHA-1 fingerprints (upload key and Play signing key) on the Google OAuth Android client**, otherwise Google Sign-In fails in Play builds with `DEVELOPER_ERROR`. |
| Builds | `eas.json` profiles: `development` (dev client), `preview` (internal APK), `production` (AAB, `autoIncrement` versionCode, prod API URL) |
| Privacy policy | Hosted page (served from the admin domain) linked in the app and in the listing |
| Data safety | Collected: name, email, phone, address, purchase history, device push token. Payment data is handled by Razorpay. Data is encrypted in transit. Users can request deletion in-app. |
| Account deletion | In-app (Account → Delete account) **and** a web URL, as Play requires both |
| Testing tracks | Internal testing from Phase 7. **New personal developer accounts must run a closed test (currently 12 testers for 14 days) before production access.** Start this early, or use an organisation account. |
| Listing | Short and full description, 4–8 phone screenshots, feature graphic 1024×500, category Shopping, content rating questionnaire |
| Updates | EAS Update (OTA) for JS-only fixes on the production channel. Native changes go through a store build. |

## 25. Development phases

Detailed tasks, commits and checks: [DEVELOPMENT_PHASES.md](DEVELOPMENT_PHASES.md).
The order is vertical slices, and **orders are built with COD before online payments**, so a full working loop exists before any gateway dependency.

| # | Phase | Slice |
|---|---|---|
| 0 | Foundation | Repo, local Postgres setup, FastAPI skeleton, Alembic, CI, env config |
| 1 | Design system & app shells | Tokens, fonts, UI primitives, Expo Router shell, first EAS dev build, admin layout shell |
| 2 | Authentication | Google → API → users/sessions → mobile + admin sign-in → role guard → tests |
| 3 | Catalog + product admin | Categories/products tables, image storage, admin CRUD, home/category/product screens |
| 4 | Search & home | pg_trgm search, suggestions, recent searches, banners, featured/popular |
| 5 | Cart & favourites | Server cart, optimistic UI, bottom cart bar, favourites |
| 6 | Addresses, settings & checkout quote | Address CRUD, shop settings, serviceability, quote |
| 7 | Orders (COD) | Transactional placement, stock deduction, state machine, customer orders + timeline, admin orders + basic dashboard. First internal-testing build. |
| 8 | Online payments | Provider abstraction, Razorpay, verify, webhook, expiry, refunds |
| 9 | Inventory & admin completion | Inventory page, Quick Stock, movements, low stock, customers, banners admin, full dashboard |
| 10 | Notifications | FCM, device tokens, status pushes, in-app list, admin new-order alert |
| 11 | Hardening | Security review, rate limits, offline/empty audit, accessibility, performance, E2E |
| 12 | Deployment | Dockerfile, staging + production infra, domains, secrets, backups, monitoring, Razorpay live keys |
| 13 | Play Store release | Store assets, policies, closed testing, production rollout |

## 26. Definition of done for every phase

**Applies to every phase:**
- The code follows the folder structure and layering above, with no business logic in routers or screens
- Alembic migration(s) are committed and `alembic upgrade head` works on a fresh database
- New endpoints are typed with Pydantic, appear in OpenAPI, and the TS types are regenerated
- Tests for the phase's business rules are written and passing; CI is green (ruff, pytest, tsc, lint, unit tests)
- Every new screen handles loading, empty, error and offline states
- No secrets in git; `.env.example` is updated
- Docs are updated if the architecture or API changed
- Small, meaningful commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- A manual check of the feature on an Android device/emulator (and in the admin UI where relevant)

**Phase-specific:**

| Phase | Done when… |
|---|---|
| 0 | Local `shop`/`shop_test` databases exist; `/health/db` returns ok; an empty Alembic migration applies; CI runs on push |
| 1 | The dev build installs on a phone; the tab shell navigates; all primitives render in a `/dev/ui` screen; the admin shell shows its sidebar; no colour outside the palette (grep check) |
| 2 | A real Google sign-in reaches Home on a device; refresh rotation and reuse detection are tested; the admin rejects non-admins (server 403 tested); logout and delete-account work |
| 3 | The shopkeeper creates a category and a product with a photo in admin, and it appears in the app without a code change |
| 4 | Search returns results as you type on seeded local data; the no-results and recent-searches states work; banners come from the database |
| 5 | +/− feels instant, rolls back if the network fails, and the cart survives an app restart; out-of-stock items can't be added (tested on the server) |
| 6 | Address CRUD with a default; an unserviceable pincode is blocked with a clear message; the quote matches the server calculation in tests |
| 7 | End-to-end COD order: stock drops, the admin moves the order to Delivered, and the customer timeline updates; the concurrency test passes; the cancel-restock test passes |
| 8 | A Razorpay test-mode payment succeeds end to end; a forged client "success" is rejected; webhook-only confirmation works; the expiry test restocks |
| 9 | Quick Stock updates 20 products in one save; conflicts appear per row; each change has a movement log entry |
| 10 | The phone receives a push for every status change, and tapping it opens the order; the admin chime plays on a new order |
| 11 | The security checklist passes; the Maestro E2E suite passes; no screen shows a blank white state when offline |
| 12 | Production API, database, admin and storage are live with production secrets; a backup has been restored once as a test; alerts are wired |
| 13 | The AAB has passed review on a testing track, the listing is complete, and the production rollout has started |

## 27. Future improvements

Coupons & offers (`coupons`, `offers`), product reviews, `delivery_zones` with radius/fees by distance, scheduled delivery slots, loose items sold by weight, "Buy again" with smart suggestions, Hindi localisation, WhatsApp order updates, SMS fallback, an admin mobile app / web push, printable packing slips, GST invoices, sales analytics and CSV export, a barcode scanner for Quick Stock, an iOS release, real-time order updates via SSE, dark mode (with a warm dark palette, never navy).

---

## Risks & dependencies

| Risk | Impact | Mitigation |
|---|---|---|
| ~~Git root is the home directory~~ | Resolved | `shop_app` now has its own repo → `github.com/vaibhav668/shop_app` |
| **Local Python env `yolo_cuda`** is an ML/CUDA env (Python 3.10). | Possible dependency conflicts with ML packages. | Backend deps pinned in `requirements.txt`; code kept 3.10-compatible (ruff `target-version = py310`); CI tests 3.10 and 3.12. |
| **JDK 26 installed; no Android SDK/`adb`.** RN/Gradle need JDK 17. | Local Android builds will fail. | Use **EAS cloud builds** for the dev client (no local Android toolchain needed); install the dev build APK on a physical phone. Optionally install Android Studio + JDK 17 later for emulator use. |
| Native modules (Google Sign-In, Razorpay) | Expo Go is not usable; a dev build is required. | First dev build in Phase 1 to surface problems early. If `react-native-razorpay` fails with the current Expo SDK, fall back to Razorpay Standard Checkout in a WebView. |
| Google Sign-In SHA-1 mismatch in Play builds | Login breaks only in production. | Register the upload + app-signing SHA-1s; test the `preview` build from the Play internal track in Phase 7. |
| Razorpay live-mode KYC | Can take days and needs business documents plus a website with terms, refund, privacy and contact pages. | Start KYC during Phase 7; host the policy pages on the admin domain. |
| Play closed-testing requirement (personal accounts) | About 2+ weeks before a production release is allowed. | Create the developer account and start the closed track by Phase 8. |
| Late payment capture after order expiry | Customer charged for a cancelled order. | Automatic refund plus an admin flag; tested. |
| Shopkeeper adoption | The system is only useful if stock is kept current. | Quick Stock mode, low-stock list on the dashboard, and an "accepting orders" switch for quick pauses. |

## Decisions needed before implementation

1. **Git:** OK to `git init` a dedicated repo inside `shop_app/`? Will you push to GitHub (needed for CI)?
2. **Brand:** shop name, and the Android package name (`in.<shopslug>.app`, which cannot be changed later).
3. **Payments:** Razorpay (recommended) or another provider (Cashfree / PhonePe PG)? Offer **Cash on Delivery** as well? (Recommended: yes.)
4. **Delivery rules:** delivery fee, free-delivery threshold, minimum order, and serviceable area (a list of pincodes is recommended for V1).
5. **Cancellation/refund policy:** can the admin cancel a paid order after dispatch? Automatic refund on admin cancel? (Recommended: yes.)
6. **Hosting & budget:** preferred backend host and managed Postgres; do you own a domain?
7. **Accounts:** who owns the Google Cloud / Firebase project, the Play Console account (personal or organisation), and the Razorpay account?
8. **Admin users:** the Google email(s) of the shopkeeper/staff to promote to ADMIN.
9. **Product photos:** shopkeeper's own photos, or licensed/brand pack shots?
10. **Customer phone number:** collected at onboarding without OTP verification in V1? (Recommended: yes; the shopkeeper calls to confirm the first order.)
