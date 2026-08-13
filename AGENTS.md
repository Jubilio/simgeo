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
- When changing models, create and run migrations: `python manage.py makemigrations` + `migrate`.

Common tasks an agent may be asked to perform

- Implement or extend API endpoints in `api/` or app `maps/`/`hazards/`.
- Add management commands under `maps/management/commands/` for data imports.
- Work with Earth Engine integration under `georisksim/gee_auth.py` and `simulation/services/`.

Suggested next agent customizations

- Create a `skills/spatial-uploads` agent to assist with Shapefile/GeoJSON import pipelines.
- Create a `skills/simgeo-chatbot` agent to help maintain the AI assistant components under `ai_agent/`.

If anything here is unclear or you'd like a separate, more detailed instruction file for frontend/backend/tests, tell me which area to focus on next.
