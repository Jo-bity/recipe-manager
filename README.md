# r3-recipe-manager

API-first MVP for creating technician-safe robot recipes, exporting vendor-neutral Recipe JSON, and previewing vendor-specific command translations.

## Normal user flow

1. In **Setup**, create or rename the Recipe. Battery layout and process constraint fields are visible as outlook placeholders for future context.
2. In **Add Step**, choose an available Step type and click **Add Step**. `Take Image` can be created as `2D image only` or `Image + point cloud`; this image output decision belongs to image input, not later Step tuning.
3. In **Step Configuration**, tune the selected Step's atomic Action:
   - `Take Image`: choose full-battery capture or a specific section. For a section, set `center.x/y` with the numeric fields or by selecting the preview image.
   - `Unscrewing`: choose automatic target detection or a specific screw position. For a specific screw, set `target.x/y` with the numeric fields or by selecting the preview image.
   - Image source and tool profile are shown as Step Configuration outlook fields.
4. In **Step List**, review the resulting ordered Steps, select a Step for configuration, move Steps up/down, or remove them.
5. Use **Validate** before exchange or preview to fail fast on incomplete Recipes.
6. Use **Recipe JSON** to export/import the vendor-neutral Recipe representation.
7. Use **Adapter Preview** to inspect how the same Recipe maps to Company A or Company B robot commands without executing robot movement.

## Sample data

Importable Recipe JSON examples live in `sample-data/`:

- `battery-pack-screw-removal.json`: short happy-path demo with full-battery imaging and automatic unscrewing.
- `section-rework-layout.json`: layout-specific demo with section imaging, point cloud capture, a specific screw target, and a follow-up image.

To try one in the UI, open **Recipe JSON**, paste the file contents into the import field, and click **Import**.

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
- Step add/update/delete/reorder
- Strict validation for `take_image` and `unscrewing` Step types and their nested Action parameters
- Canonical Recipe JSON import/export
- Vendor command preview for Company A and Company B
- Small technician-facing React UI with Setup, Add Step, Step Configuration, Step List, Recipe JSON, and Adapter Preview views

Outlook:

- Real robot execution
- Authentication and permissions
- Battery layout, process constraints, image source, tool profile, and richer image annotation
- Execution history and audit logs
- PostgreSQL deployment hardening
