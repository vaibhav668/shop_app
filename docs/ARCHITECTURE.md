# Architecture

This document expands on [PROJECT_PLAN.md §9](PROJECT_PLAN.md#9-architecture).

## 1. System context

| Component | Runtime | Talks to |
|---|---|---|
| Customer app | Android (Expo dev/prod build) | API, Google Sign-In, Razorpay SDK, FCM |
| Admin web | Browser (static SPA) | API, Google Identity Services |
| API | FastAPI (uvicorn locally; container at deploy time) | PostgreSQL, Google certs, Razorpay API, Cloudinary/S3, FCM |
| Database | Managed PostgreSQL | — |

The API is the only component that writes business data. Neither client ever talks to the database, storage or payment secrets directly.

## 2. Backend layering

```
routers/          HTTP: parse and validate (Pydantic), call a service, map the result to a response schema. No SQL, no business rules.
dependencies/     get_db (session per request), get_current_user, require_admin, get_payment_provider, get_storage, get_push
services/         Business rules and transaction boundaries. Services may call repositories and other services.
repositories/     SQLAlchemy queries grouped by aggregate. Return models; never commit.
models/           SQLAlchemy 2.0 typed declarative models.
schemas/          Pydantic v2 DTOs (request/response). Kept separate from models.
integrations/     Adapters for external systems, each behind a Protocol:
                    google_auth.GoogleVerifier
                    payments.PaymentProvider   (RazorpayProvider, FakePaymentProvider)
                    storage.StorageProvider    (CloudinaryStorage, S3Storage, LocalStorage)
                    push.PushProvider          (FcmPush, FakePush)
jobs/             payment_expiry: runs every 60 s, guarded by pg_try_advisory_lock
core/             config (pydantic-settings), database (engine/session), security (JWT, hashing), errors (AppError → JSON), logging
```

**Transactions:** a service method that changes data owns the transaction (`with session.begin():`). Repositories only `flush`. Side effects (push notifications, provider calls, refunds) run **after commit**. Nothing is sent to the outside world for a change that later rolls back.

**Provider selection** comes from configuration (`PAYMENT_PROVIDER=razorpay|fake`, `STORAGE_PROVIDER=cloudinary|s3|local`, `PUSH_PROVIDER=fcm|fake`). Tests and local development need no third-party accounts.

### Core services

| Service | Responsibility |
|---|---|
| `AuthService` | Verify Google token, find or create the user, issue/rotate/revoke sessions |
| `CatalogService` | Home composition, product lists, related products |
| `SearchService` | Trigram search + suggestions |
| `PricingService` | **The only place** that turns `(product, qty)` pairs + address + settings into subtotal, fee and total |
| `CartService` | Cart reads/writes with availability checks |
| `InventoryService` | **The only place** that changes `stock_quantity`; always writes `inventory_movements` |
| `OrderService` | Place order, list, detail, customer cancel |
| `OrderStateMachine` | Allowed transitions, and what happens on each one (history, restock, refund, notify) |
| `PaymentService` | Create session, verify client callback, handle webhook, expiry, refund. Receives a `PaymentProvider`. |
| `NotificationService` | Store the notification and send the push |
| `AdminDashboardService` | Aggregates, calculated in the shop's timezone |

### PaymentProvider protocol

```python
class PaymentProvider(Protocol):
    name: str
    def create_order(self, *, receipt: str, amount_paise: int, currency: str) -> ProviderOrder: ...
    def verify_checkout_signature(self, *, provider_order_id: str, provider_payment_id: str, signature: str) -> bool: ...
    def fetch_payment(self, provider_payment_id: str) -> ProviderPayment: ...      # status, amount, method
    def parse_webhook(self, *, body: bytes, headers: Mapping[str, str]) -> WebhookEvent: ...  # raises on bad signature
    def refund(self, *, provider_payment_id: str, amount_paise: int) -> ProviderRefund: ...
```
Order logic never imports Razorpay. Switching to Cashfree or PhonePe means adding one adapter.

## 3. Why sync SQLAlchemy

One shop means tens of concurrent users at most. Sync SQLAlchemy with psycopg 3 runs in FastAPI's threadpool, avoids the pitfalls of async lazy-loading, and makes `FOR UPDATE` transactions easy to follow. Moving to async later affects only the repository and database layer.

## 4. Auth details

- Access JWT: HS256, 15 min TTL, claims `sub`, `role`, `sid`, `iat`, `exp`. `get_current_user` loads the user on each request, so disabling an account or changing a role takes effect right away.
- Refresh token: 32 random bytes (base64url). Only its SHA-256 hash is stored. It is rotated on every refresh.
- Mobile: tokens live in `expo-secure-store`. The API client serialises refreshes (a single request in flight; other requests wait for it) and retries once after a 401 `TOKEN_EXPIRED`.
- Admin: the access token is kept in memory; the refresh token is an httpOnly cookie. Refreshing the page triggers a silent `/auth/refresh`.
- Admin promotion: `python -m app.cli make-admin <email>` (the user must have signed in at least once).

## 5. Mobile app structure (Expo Router)

```
app/
  _layout.tsx                 Providers: QueryClient, Auth, Fonts, SafeArea, GestureHandler, NetInfo banner
  index.tsx                   Redirects based on auth state
  (auth)/_layout.tsx
  (auth)/welcome.tsx          Brand, "Continue with Google", failure state
  (auth)/onboarding.tsx       Name + phone
  (app)/_layout.tsx           Auth guard + CartBar overlay
  (app)/(tabs)/_layout.tsx    Tabs: Home, Categories, Orders, Account
  (app)/(tabs)/index.tsx      Home
  (app)/(tabs)/categories.tsx
  (app)/(tabs)/orders.tsx
  (app)/(tabs)/account.tsx
  (app)/search.tsx
  (app)/category/[slug].tsx
  (app)/product/[id].tsx
  (app)/cart.tsx
  (app)/checkout.tsx
  (app)/payment-result.tsx
  (app)/orders/[id].tsx
  (app)/addresses/index.tsx, new.tsx, [id].tsx
  (app)/favourites.tsx
  (app)/notifications.tsx
  (app)/settings.tsx          Notification preference, privacy policy, delete account, app version
```
The cart is a stack screen, not a tab. A persistent **CartBar** above the tab bar (and on catalog screens) shows the item count and total, and opens the cart.

### Data layer
- `src/api/client.ts`: a thin `fetch` wrapper that adds the base URL (`EXPO_PUBLIC_API_URL`), bearer token, refresh-on-401, 15 s timeout, and parses the error shape into `ApiError { code, message, details }`.
- `src/api/schema.ts`: generated by `openapi-typescript`, never edited by hand.
- One hook module per domain: `useHome`, `useProducts` (infinite), `useProduct`, `useCart`, `useSetCartQuantity` (optimistic), `useOrders`, `usePlaceOrder`, …
- Query keys are defined in one `queryKeys.ts`.
- **Optimistic cart:** `onMutate` patches the cached `Cart` (lines and client-estimated totals), `onError` rolls back and shows a toast with the server's message, `onSettled` replaces it with the server `Cart`. A 300 ms debounce per product merges quick taps into one request.
- Offline: `NetInfo` feeds TanStack Query's `onlineManager`. A slim "You're offline" banner appears, cached screens stay usable, and mutations are blocked with a clear message (orders are never queued offline).

## 6. Admin app structure

```
admin/src/
  main.tsx, App.tsx (router + QueryClient + AuthProvider)
  api/        client.ts (cookie refresh), schema.ts (generated), hooks per domain
  routes/     Dashboard, Orders, OrderDetailDrawer, Inventory, QuickStock, Products, ProductForm, Categories, Banners, Customers, Settings, SignIn
  components/ Sidebar, PageHeader, DataTable, StatusBadge, Money, StockCell, EmptyState, ConfirmDialog, ImageUpload, Toast
  styles/     tokens.css (CSS variables), globals.css
```

## 7. Configuration

**backend/.env.example**
```
APP_ENV=local
DATABASE_URL=postgresql+psycopg://shop:shop@localhost:5432/shop
TEST_DATABASE_URL=postgresql+psycopg://shop:shop@localhost:5432/shop_test
JWT_SECRET=change-me-64-random-bytes
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=60
GOOGLE_ALLOWED_CLIENT_IDS=xxxx.apps.googleusercontent.com
CORS_ORIGINS=http://localhost:5173
ADMIN_COOKIE_SECURE=false
SHOP_TIMEZONE=Asia/Kolkata
PAYMENT_PROVIDER=fake
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
STORAGE_PROVIDER=local
CLOUDINARY_URL=
S3_ENDPOINT_URL=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_PUBLIC_BASE_URL=
PUSH_PROVIDER=fake
FIREBASE_CREDENTIALS_JSON_BASE64=
SENTRY_DSN=
```
**mobile/.env.example:** `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. `google-services.json` is provided as an EAS file secret and is never committed.
**admin/.env.example:** `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`.

## 8. Local development

```
# Local PostgreSQL 18 (Windows service) — one-time: psql -U postgres -f backend/scripts/create_local_db.sql
conda activate yolo_cuda                     # per the user's instruction; Python deps are installed here
pip install -r backend/requirements-dev.txt
cd backend && alembic upgrade head && python -m app.cli seed-dev && uvicorn app.main:app --reload
cd admin && npm i && npm run dev
cd mobile && npm i && npx expo start --dev-client   # needs the EAS dev build installed on a phone
```
`seed-dev` loads **development-only** sample categories and products into the local database. The apps themselves never contain product data.

## 9. CI (GitHub Actions)

- `backend`: set up Python 3.12 → install → `ruff check` → `ruff format --check` → `alembic upgrade head` on a Postgres service → `pytest`
- `admin`: `npm ci` → `tsc --noEmit` → `eslint` → `vitest run` → `vite build`
- `mobile`: `npm ci` → `tsc --noEmit` → `eslint` → `jest`
- `contracts`: regenerate the OpenAPI types and fail if the committed `schema.ts` files differ
