# AGENTS — AI Coding Agent Instructions

Purpose: provide concise, actionable instructions so an AI coding agent can be productive quickly in this repository.

Quick start (developer commands)

- **Python env**: create and activate virtualenv (Windows): `python -m venv venv` then `venv\\Scripts\\Activate.ps1`.
- **Install deps**: `pip install -r requirements.txt`.
- **Run migrations**: `python manage.py migrate`.
- **Run backend**: `python manage.py runserver 8000` (API: `http://localhost:8000/api/`).
- **Run frontend**: `cd frontend && npm install && npm run dev` (frontend: `http://localhost:5173`).
- **Docker** (local infra): `docker compose up -d` (starts PostGIS on port 5433, Redis, PgAdmin).

Where to look (important files)

- Project overview: [README.md](README.md)
- Environment & onboarding: [SETUP_GUIDE.md](SETUP_GUIDE.md)
- Django project settings: `georisksim/settings.py`
- Entry point: `manage.py`
- Maps import & management commands: `maps/management/commands/` (see `import_mozambique_boundaries.py`).
- Spatial services: `simulation/services/`, `services/gee_service.py`, `services/malaria_service.py`.
- Frontend app: `frontend/src/` (React + Vite). See `frontend/package.json`.
- Docs: `docs/` (e.g., `docs/MALARIA_SUITABILITY.md`) — link instead of copying.

Key conventions & notes for agents

- This is a Django + GeoDjango project using PostGIS (DB on port 5433 by default via Docker).
- GIS C libraries (GDAL/GEOS) are required on Windows (OSGeo4W or QGIS). Follow `SETUP_GUIDE.md` for `GDAL_LIBRARY_PATH` and `GEOS_LIBRARY_PATH`.
- Prefer linking to existing docs instead of duplicating content; only add concise, non-obvious guidance here.
- Tests: run `python manage.py test` for Django tests.
- Scientific registry: run `python scripts/validate_scientific_specs.py` and
  `python -m unittest scripts.tests.test_validate_scientific_specs`.
- Frontend validation: run `cd frontend`, `npm run lint` and `npm run build`.
- When changing models, create and run migrations: `python manage.py makemigrations` + `migrate`.

Scientific module workflow

- Read `docs/SCIENTIFIC_DEVELOPMENT_FRAMEWORK.md` before changing a simulator,
  index, dataset, weight, threshold, CRS, scale or interpretation.
- Update `docs/scientific-modules/registry.json` and the module methodology in
  the same change as the code.
- Keep hazard, exposure, vulnerability, impact and contextual totals distinct.
- Return the effective dataset version, period, unit, CRS/scale, disclaimer and
  fallback in API metadata whenever applicable.
- Add a regression test for every scientific or operational bug. Mocks validate
  contracts, not scientific correctness; declare the actual V0–V4 evidence.
- Record cross-module decisions in `docs/DECISIONS.md` and material unresolved
  limitations in `docs/KNOWN_ISSUES.md`.

Common tasks an agent may be asked to perform

- Implement or extend API endpoints in `api/` or app `maps/`/`hazards/`.
- Add management commands under `maps/management/commands/` for data imports.
- Work with Earth Engine integration under `georisksim/gee_auth.py` and `simulation/services/`.

Pull requests must use the repository checklist, report all validation that was
actually run and disclose AI assistance together with the human verification.
