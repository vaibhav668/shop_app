# Security and hardening

What protects Bada Bazar today, how it is checked, and what is still open. Phase 11 of [DEVELOPMENT_PHASES.md](DEVELOPMENT_PHASES.md).

## Who can do what

- **Prices, stock and totals** are calculated on the server only (`PricingService`, `InventoryService`); the app's numbers are estimates that the server replaces. Orders carry `expected_total_paise` and are refused with `PRICE_CHANGED` if the server's total differs.
- **Admin rights** are enforced by the backend: the whole `/admin` router depends on `require_admin`. `ADMIN_EMAILS` only promotes accounts signed in with a verified Google token.
- **Automated sweep** (`tests/test_authorization_sweep.py`) reads every route from the OpenAPI document and checks that every `/admin` route returns 401 when signed out and 403 for a customer, and that every personal route (`/me`, `/cart`, `/favourites`, `/addresses`, `/checkout`, `/orders`, `/notifications`) returns 401 when signed out. New routes are covered automatically.
- **Dev login** (`/auth/dev-login`) exists only when `DEV_LOGIN_ENABLED=true` in `local`/`test`; settings refuse to start otherwise.

## Rate limits

In-process sliding windows (`app/core/rate_limit.py`), per client IP. They are on everywhere except the test suite (`RATE_LIMITS_ENABLED` overrides). Behind a proxy, run the server with `--proxy-headers --forwarded-allow-ips=<proxy>` so the client IP is real.

| Rule | Limit |
|---|---|
| Every `/api` request | 600 per minute |
| `POST /auth/google` | 10 per minute |
| `POST /auth/refresh` | 30 per minute |
| `POST /auth/admin-handoff/redeem` | 10 per minute |
| `POST /orders` | 10 per minute |
| `POST /checkout/quote` | 30 per minute |
| `GET /products` (search and lists) | 120 per minute |
| `GET /products/suggest` | 180 per minute |
| `POST /admin/uploads/images` | 30 per minute |

Over the limit: HTTP 429, `RATE_LIMITED`, and a `Retry-After` header. Counts are per worker process, so with N workers a client can reach N times a limit; that is acceptable for one shop. Move the counters to Redis if the API ever runs on many machines.

## Headers and request size

`app/core/security_headers.py` adds to every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (no camera, microphone or location), `Cross-Origin-Opener-Policy: same-origin`, and `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` (the API serves data only). Auth, account, order and admin responses get `Cache-Control: no-store`. Staging and production add `Strict-Transport-Security`. Bodies over 6 MB are refused with 413 before they are read. CORS is the outermost layer, so even 413 and 429 responses are readable by the browser apps.

## Uploads

Photos are checked for size (5 MB), type (JPEG, PNG, WebP), pixel count (decompression bombs) and readability, then always re-encoded to WebP; nothing uploaded is served as-is. Product and category photos are additionally trimmed and centred on a white square.

## Tokens and sessions

Access tokens last 15 minutes; refresh tokens rotate on every use and are stored hashed. The admin's refresh token is an httpOnly cookie. The app-to-admin handoff code is single-use, hashed and valid for 60 seconds. `JWT_SECRET` must be 32+ random characters outside local/test.

## Dependency audit (12 Oct 2026)

| Area | Command | Result |
|---|---|---|
| Backend | `pip-audit -r backend/requirements.txt` | No known vulnerabilities (Pillow 12.3.0, PyJWT 2.15.0) |
| Admin | `npm audit --omit=dev` | 0 vulnerabilities |
| Mobile | `npm audit --omit=dev` | 5 advisories, all transitive through Expo / React Native tooling: `braces`, `node-forge`, `sprintf-js`, `uuid` (build and dev-server tools, not in the app) and `decode-uri-component` (URL parsing; worst case a malformed link slows the app on that one device). The only fixes are forced major upgrades that break Expo's pinned versions; they clear with the next Expo SDK upgrade. |

Run the three commands again before every release.

## Performance check (12 Oct 2026, local)

Server time on the seeded catalog: `/home` 27 ms (one query per aisle rail), `/products` and search 9 ms, `/shop` 4 ms. Indexes cover products by category, search (trigram), orders by user and by status, and order items by order and product. The deals and "Under ₹99" rails scan the product table, which is fine for a single shop's catalog (hundreds to a few thousand products).

## Still open

- **End-to-end device tests (Maestro)**: need a development build with a test-only sign-in bypass in a separate `e2e` build profile. Planned with the Play Store build.
- **Error monitoring (Sentry)** and uptime checks: part of deployment (Phase 12).
- **Admin web Content-Security-Policy**: set by the web server that hosts the admin build (see the deployment guide).
