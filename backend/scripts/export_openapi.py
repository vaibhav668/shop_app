"""Writes the API contract to backend/openapi.json; the frontends generate their types from it.

Usage (from backend/): python scripts/export_openapi.py
"""

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402

# dev-login is included so local builds of the apps can type-check their dev sign-in path.
spec = create_app(Settings(app_env="local", dev_login_enabled=True)).openapi()
out = BACKEND_DIR / "openapi.json"
out.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n", encoding="utf-8")
print(f"Wrote {out.relative_to(BACKEND_DIR.parent)}")
