# Bada Bazar

A grocery ordering platform for a single local shop. It has three parts: an Android customer app (Expo), a web admin dashboard for the shopkeeper (React), and a FastAPI + PostgreSQL backend.

Android package name: `com.badabazar.app` (permanent once the app is on the Play Store).

Start with [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

| Folder | What | Status |
|---|---|---|
| `backend/` | FastAPI, SQLAlchemy, Alembic | Phase 6 — addresses, checkout quote, shop settings |
| `mobile/` | Expo SDK 57 + React Native customer app | Phase 6 — saved addresses, checkout screen |
| `admin/` | Vite + React admin dashboard | Phase 6 — catalog, banners, shop settings |
| `docs/` | Plan, architecture, schema, API, UI system | — |
| `scripts/` | Repo-wide checks (palette guard) | — |

## Run locally

Everything runs on this machine. There is no Docker; containers come in the deployment phase.

### 1. Database (one time)

PostgreSQL 18 runs as a local Windows service. Create the app role and databases (you'll be asked for the `postgres` password):

```bash
"/c/Program Files/PostgreSQL/18/bin/psql" -h localhost -U postgres -f backend/scripts/create_local_db.sql
```

This creates the role `shop` (password `shop`, **for local development only**) and the databases `shop` and `shop_test`.

### 2. Backend

```bash
conda activate yolo_cuda
cd backend
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
python -m app.cli seed-dev   # optional: sample categories and products (local only)
uvicorn app.main:app --reload
```

Uploaded photos are stored in `backend/media/` during local development (`STORAGE_PROVIDER=local`). Set `STORAGE_PROVIDER=cloudinary` and `CLOUDINARY_URL` to use Cloudinary.

Check that it's working: <http://localhost:8000/api/v1/health/db>. The API docs are at <http://localhost:8000/docs>.

### 3. Admin dashboard

```bash
cd admin
npm install
npm run dev          # http://localhost:5173
```

### 4. Mobile app

```bash
cd mobile
npm install
npx expo start --go  # scan the QR code with the Expo Go app (SDK 57) to preview the UI
```

In the app, go to **Account → Open UI kit** (development only) to see every design-system component.

From Phase 2, Google Sign-In needs a development build instead of Expo Go: `npx eas-cli@latest build --profile development --platform android`. This requires a free Expo account.

## Signing in locally

Until Google OAuth is set up ([docs/SETUP_GOOGLE_SIGNIN.md](docs/SETUP_GOOGLE_SIGNIN.md)), both apps show a **development email sign-in**. It works only when `DEV_LOGIN_ENABLED=true` and `APP_ENV=local`, and it is never available in production.

1. Open the mobile app (web preview or Expo Go) and sign in with any email, e.g. `you@example.com`. Enter a name and phone number on the onboarding screen.
2. Make that account a shop admin:
   ```bash
   cd backend && python -m app.cli make-admin you@example.com
   ```
3. Sign in to the admin dashboard with the same email.

## API types

The frontends' API types are generated from the backend. After changing an endpoint:

```bash
cd backend && python scripts/export_openapi.py
cd mobile && npm run gen:api
cd admin && npm run gen:api
```

CI fails if these are out of date.

## Checks

```bash
cd backend && ruff check . && ruff format --check . && pytest
cd mobile  && npm run typecheck && npm run lint && npm run format:check && npm test
cd admin   && npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
node scripts/check-palette.mjs
```
