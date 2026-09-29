# Development Phases

Each phase is a vertical slice: database → API → UI → tests. Before each phase starts, Claude posts a short "what will change" note and waits for approval. The definitions of done are in [PROJECT_PLAN.md §26](PROJECT_PLAN.md#26-definition-of-done-for-every-phase).

---

## Phase 0 — Foundation
**Goal:** an empty but correctly wired monorepo.
- `git init` in `shop_app/` (after approval), `.gitignore` (Python, Node, Expo, `.env*` except `.env.example`, `google-services.json`, keystores)
- Local PostgreSQL (the installed Windows service, no Docker): `backend/scripts/create_local_db.sql` creates the `shop` role plus the `shop` and `shop_test` databases
- `backend/`: `pyproject.toml` + pinned `requirements.txt` / `requirements-dev.txt`; `app/main.py` (app factory), `core/config.py`, `core/database.py`, `core/errors.py` (AppError + handlers for the standard error shape), `core/logging.py`, `/health`, `/health/db`
- Alembic init with naming conventions; first migration enables `pg_trgm` and `citext`
- pytest setup: session-scoped engine on `shop_test`, a transaction rolled back per test, an API client fixture
- `ruff` config; GitHub Actions `ci.yml` (backend job only for now)
- `.env.example` files
- Verify the Python version of the `yolo_cuda` env and install backend deps there

Commits: `chore: initialize monorepo and gitignore` · `chore(backend): add local database setup script` · `feat(backend): scaffold fastapi app with config and health checks` · `chore(backend): set up alembic and pytest` · `ci: add backend workflow`

## Phase 1 — Design system & app shells
- `mobile/`: `create-expo-app` (SDK 57, TypeScript, Expo Router, routes in `src/app`), path aliases, ESLint/Prettier, Jest + RNTL
- `src/theme/tokens.ts`, `typography.ts`; Inter fonts; primitives: `Text`, `Button`, `IconButton`, `Input`, `Chip`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`, `OfflineBanner`, `QuantityStepper`, `Money`, `ProductCard` (with static props), `SectionHeader`, `Screen`
- A `/dev/ui` screen (development builds only) listing every primitive
- Tab shell (Home, Categories, Orders, Account) with placeholder screens that use the empty states
- `app.config.ts` (package name from env, adaptive icon placeholder, splash, `blockedPermissions`), `eas.json` profiles
- **First EAS development build** installed on a physical Android phone
- `admin/`: Vite React TS, tokens.css, Inter, Sidebar layout, route placeholders, Vitest
- CI: add the admin and mobile jobs; add the palette grep check

Commits: `feat(mobile): initialize expo app with router and typescript` · `feat(mobile): add design tokens and ui primitives` · `feat(mobile): add tab navigation shell` · `chore(mobile): configure eas build profiles` · `feat(admin): initialize vite react admin with layout shell` · `ci: add frontend jobs and palette check`

## Phase 2 — Authentication
- Models + migration: `users`, `user_sessions`, `device_tokens`
- `GoogleVerifier`, `AuthService`, `core/security.py` (JWT, token hashing), `get_current_user`, `require_admin`
- Routes: `/auth/google`, `/auth/refresh`, `/auth/logout`, `/me` (GET/PATCH/DELETE)
- CLI: `make-admin`
- Mobile: `AuthProvider`, API client with refresh handling, splash → welcome → Google → onboarding → Home; failure screen; logout
- Admin: Google sign-in page, in-memory token + cookie refresh, route guard, "not an admin" screen
- Generate the OpenAPI TS types (`npm run gen:api` in both apps)
- Tests: token verification paths (mocked Google), new vs returning user, refresh rotation + reuse detection, disabled user, admin 403 sweep (a parametrised test over every `/admin` route)
- Setup outside the code: Google Cloud OAuth clients (Web + Android with the dev SHA-1)

Commits: `feat(backend): add users and sessions models` · `feat(backend): add google token verification and jwt sessions` · `feat(mobile): add google sign-in flow and onboarding` · `feat(admin): add admin sign-in and route guard` · `test(backend): cover auth and admin authorization`

## Phase 3 — Catalog + product admin
- Models + migration: `categories`, `products`, `inventory_movements`, `shop_settings` (seed row). *(`banners` moved to Phase 4 with the Home screen.)*
- `StorageProvider` (local + Cloudinary), `/admin/uploads/images`
- Admin API: categories CRUD/reorder, products CRUD/archive/restore, stock set (with `expected_stock` conflict check) and +/− adjust via `InventoryService`
- Public API: `/categories`, `/products`, `/products/{id}`, `/shop`
- Admin UI: Categories page, Products list + form (image upload, price/MRP validation, category select, unit, description, featured, active)
- Mobile: Categories tab, category product list (infinite), product detail (all states including "Out of stock"), image caching
- `seed-dev` CLI (sample data, refuses to run unless `APP_ENV=local`)
- Tests: price/MRP validation, archived and inactive products hidden from customers, pagination, admin-only writes

## Phase 4 — Search & home
- `banners` table + admin Banners page; trigram index migration; `SearchService`; `/products?q=`, `/products/suggest`
- `/home` composition (banners, categories, featured, popular, buy_again returns empty until orders exist)
- Mobile: Home (greeting, address chip placeholder, search entry, categories, banners, sections), Search screen (debounced suggestions, recent searches in AsyncStorage, category chips, results, no-results)
- Tests: search relevance basics (prefix, typo tolerance, keywords like "doodh"), suggestion limit

## Phase 5 — Cart & favourites
- Models: `carts`, `cart_items`, `favourites`
- `PricingService` (subtotal, delivery fee, free-delivery remaining, min order remaining), `CartService`
- API: cart endpoints, favourites endpoints
- Mobile: `useCart`, optimistic `useSetCartQuantity` with debounce + rollback, ADD → stepper on every product card, CartBar, Cart screen (issues shown on each line, e.g. out of stock), Favourites screen + heart toggle
- Tests: cannot add unavailable/out-of-stock products, quantity capped by stock and `max_per_order`, pricing edge cases (the free-delivery boundary), unit test for the optimistic rollback

## Phase 6 — Addresses, shop settings & checkout quote
- Model: `addresses`; `/addresses` CRUD + default; serviceability check against `shop_settings.serviceable_pincodes`
- `/checkout/quote`
- Admin Settings page (delivery fee, free-delivery threshold, minimum order, pincodes, payment methods, accepting orders, closed message)
- Mobile: address list/form (validation: pincode, phone), address picker sheet, Checkout screen (address → summary → payment method → total) using the quote
- Tests: one-default invariant, ownership (another user's address → 404), unserviceable pincode, below minimum, shop closed

## Phase 7 — Orders (Cash on Delivery)
- Models: `orders`, `order_items`, `order_status_history`, `payments` (the table is created now and used in Phase 8)
- `InventoryService`, `OrderService.place_order` (transaction as in DATABASE_SCHEMA), `OrderStateMachine`
- API: `/orders` (create/list/detail/cancel), `/admin/orders`, `PATCH /admin/orders/{id}/status`, a basic `/admin/dashboard`, `/admin/orders/summary`
- Mobile: Place order → success screen, Orders tab (active/past), Order detail + timeline, cancel; polls the order detail every 20 s while the screen is focused
- Admin: Orders table + detail drawer + next-status button + cancel dialog, new-order polling + chime, Dashboard v1
- Tests: **concurrency last-unit race**, idempotent double submit, `PRICE_CHANGED`, every state-machine edge, cancel restores stock, COD becomes PAID on delivery, customer cannot see or cancel others' orders
- Release: first **internal testing** build on Play (`preview` profile); register the Play signing SHA-1 with Google OAuth
- Outside the code: start Razorpay KYC and draft the policy pages

## Phase 8 — Online payments
- `PaymentProvider` protocol, `FakePaymentProvider`, `RazorpayProvider` (httpx + HMAC)
- `PaymentService`: create session, verify, webhook, retry, expiry job (advisory lock), refund on cancel, late-capture auto-refund + `needs_review`
- Mobile: `react-native-razorpay` integration (fallback: WebView checkout), payment result screen with the "waiting for confirmation" state, retry payment on the order detail
- Admin: payment status column, a "needs review" list on the dashboard
- Tests: valid/forged signature, amount mismatch rejected, verify + webhook arriving together (idempotent), expiry restocks, refund on admin cancel, late-capture refund
- Outside the code: Play closed-testing track started (if on a personal developer account)

## Phase 9 — Inventory & admin completion
- API: stock-adjust, set-with-expected, bulk, movements; low-stock filter
- Admin: Inventory page (search, category filter, +/−, inline edit, enable toggle, low-stock indicator, history drawer), **Quick Stock mode**, Customers pages, Banners page, full Dashboard
- Tests: bulk partial conflicts, a negative result rejected, a movement row written for every change, dashboard numbers calculated in the shop's timezone at the day boundary

## Phase 10 — Notifications
- Firebase project, `google-services.json` via EAS secret, `expo-notifications` permission prompt (asked after the first order, not at launch)
- `PushProvider` (FCM, fake), `NotificationService`, post-commit hooks in `OrderStateMachine` / `PaymentService`, invalid-token cleanup
- API: `/me/devices`, `/notifications`
- Mobile: notifications list, tap → deep link to the order, unread dot on Account
- Tests: a notification row is created per transition, the push is sent after commit (not when the transaction rolls back), invalid tokens are pruned

## Phase 11 — Hardening
- Security checklist: authorization sweep, rate limits (`slowapi`), CORS, headers, upload validation, log scrubbing, dependency audit (`pip-audit`, `npm audit`)
- Audit every screen for loading/empty/error/offline states; accessibility (labels, contrast, 1.3× font scaling)
- Performance: `EXPLAIN` on hot queries, image sizes, list rendering profile, cold-start measurement
- Maestro E2E flows (test auth bypass only in the `e2e` build profile)

## Phase 12 — Production deployment
- `backend/Dockerfile` (python:3.12-slim, non-root user, gunicorn+uvicorn). **Containers are deliberately deferred until this phase; everything before it runs locally.**
- Staging environment first (fake payment provider), then production
- Production Postgres (in or near India), backups + a restore drill, Cloudinary production folder, Firebase production, Razorpay live keys + webhook URL
- Domains + HTTPS: `api.` and `admin.`; production env vars in the host's secret store
- Migrations as a release step; Sentry + uptime check on `/health/db`
- Hosted privacy policy, terms, refund policy and account-deletion pages

## Phase 13 — Play Store release
- Final icon, splash, screenshots, feature graphic, listing copy
- Data safety form, content rating, target audience, privacy policy URL, account deletion URL
- `eas build --profile production` → AAB → closed/open testing → production staged rollout (20% → 100%)
- Post-launch: EAS Update channel for JS hotfixes, crash monitoring

---

## Dependency order (why this sequence)

```
0 Foundation → 1 Shells → 2 Auth → 3 Catalog(+admin CRUD, since products must come from the DB)
→ 4 Search/Home → 5 Cart → 6 Address/Checkout quote → 7 Orders (COD) → 8 Payments
→ 9 Inventory/Admin → 10 Notifications → 11 Hardening → 12 Prod → 13 Play Store
```
- Product admin moves up to Phase 3, because "no hard-coded products" means the shopkeeper needs a way to enter them before the catalog UI means anything.
- Orders with COD come before online payments, so a complete, testable order loop exists without waiting for Razorpay KYC.
- Everything runs locally until Phase 12 (by decision: no Docker/cloud until the end). Play internal testing (Phase 7) still starts early, pointing at a tunnelled/LAN dev API, so signing and Google Sign-In problems show up well before launch.
