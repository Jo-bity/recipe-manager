# r3-recipe-manager

API-first MVP for creating technician-safe robot recipes, exporting vendor-neutral Recipe JSON, and previewing vendor-specific command translations.

## Run locally

Backend API:

```bash
PYTHONPATH=backend/src uvicorn app.main:app --reload
```

React UI during development:

```bash
cd frontend
npm install
npm run dev
```

Open:

- React UI dev server: http://localhost:5173
- API docs: http://localhost:8000/docs

To build the React UI into the FastAPI static directory:

```bash
cd frontend
npm install
npm run build
```

## Run with Docker Compose

```bash
docker compose up --build
```

## Test

```bash
PYTHONPATH=backend/src python -m unittest discover -s backend/tests -v
```

## MVP scope

Core:

- Recipe CRUD
- Action add/update/delete/reorder
- Strict validation for `take_image` and `unscrewing` Action parameters
- Canonical Recipe JSON import/export
- Vendor command preview for Company A and Company B
- Small technician-facing React UI

Outlook:

- Real robot execution
- Authentication and permissions
- Rich image annotation
- Execution history and audit logs
- PostgreSQL deployment hardening
