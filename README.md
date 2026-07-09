# r3-recipe-manager

API-first MVP for creating technician-safe robot recipes, exporting vendor-neutral Recipe JSON, and previewing vendor-specific command translations.

## Normal user flow

1. Create or select a Recipe from the sidebar.
2. In **Setup**, give the Recipe a clear operational name. Battery layout and process constraint fields are shown as outlook placeholders for future context.
3. In **Action List**, add the intended robot procedure as ordered Actions, starting with `Take Image` or `Unscrewing`.
4. Select an Action and configure it in **Action Configuration** using technician-facing groups:
   - `Take Image`: choose the capture area and whether depth data should be captured as a point cloud.
   - `Unscrewing`: choose automatic target detection or a specific screw position.
5. Use **Validate** before exchange or preview to fail fast on incomplete Recipes.
6. Use **Recipe JSON** to export/import the vendor-neutral Recipe representation.
7. Use **Adapter Preview** to inspect how the same Recipe maps to Company A or Company B robot commands without executing robot movement.

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
