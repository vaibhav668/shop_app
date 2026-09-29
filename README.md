# Daily Basket

A grocery ordering platform for a single local shop. It has three parts: an Android customer app (Expo), a web admin dashboard for the shopkeeper (React), and a FastAPI + PostgreSQL backend.

"Daily Basket" and the Android package name `com.placeholder.dailybasket` are placeholders until the real brand is chosen.

Start with [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

| Folder | What | Status |
|---|---|---|
| `backend/` | FastAPI, SQLAlchemy, Alembic | Phase 0 — skeleton, health checks |
| `mobile/` | Expo SDK 57 + React Native customer app | Phase 1 — design system, tab shell |
| `admin/` | Vite + React admin dashboard | Phase 1 — layout shell |
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
uvicorn app.main:app --reload
```

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

## Checks

```bash
cd backend && ruff check . && ruff format --check . && pytest
cd mobile  && npm run typecheck && npm run lint && npm run format:check && npm test
cd admin   && npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
node scripts/check-palette.mjs
```
