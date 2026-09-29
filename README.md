# Shop App

A grocery ordering platform for a single local shop. It has three parts: an Android customer app (Expo), a web admin dashboard for the shopkeeper (React), and a FastAPI + PostgreSQL backend.

Start with [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

| Folder | What | Status |
|---|---|---|
| `backend/` | FastAPI, SQLAlchemy, Alembic | Phase 0 |
| `mobile/` | Expo + React Native customer app | Phase 1 |
| `admin/` | Vite + React admin dashboard | Phase 1 |
| `docs/` | Plan, architecture, schema, API, UI system | — |

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

### Checks

```bash
cd backend
ruff check . && ruff format --check .
pytest
```
