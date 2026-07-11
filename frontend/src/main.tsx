import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "./styles.css";

type Coordinate = {
  x: number;
  y: number;
};

type TakeImageParameters = {
  include_pointcloud: boolean;
  image_scope: "full_battery" | "section";
  center?: Coordinate;
};

type UnscrewingParameters = {
  mode: "automatic" | "specific";
  target?: Coordinate;
};

type TakeImageAction = {
  id: string;
  type: "take_image";
  parameters: TakeImageParameters;
};

type UnscrewingAction = {
  id: string;
  type: "unscrewing";
  parameters: UnscrewingParameters;
};

type RecipeAction = TakeImageAction | UnscrewingAction;

type Recipe = {
  id: string;
  schema_version: "1.0";
  name: string;
  actions: RecipeAction[];
  created_at: string;
  updated_at: string;
};

type RecipeDocument = {
  schema_version: "1.0";
  name: string;
  actions: RecipeAction[];
};

type WorkspaceView = "editor" | "preview" | "json";

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "");
const API_DOCS_URL = `${API_BASE_URL || "http://localhost:8000"}/docs`;

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(JSON.stringify(payload.detail ?? payload, null, 2));
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function defaultAction(type: RecipeAction["type"]): Omit<RecipeAction, "id"> {
  if (type === "take_image") {
    return {
      type: "take_image",
      parameters: {
        include_pointcloud: false,
        image_scope: "full_battery",
      },
    };
  }
  return {
    type: "unscrewing",
    parameters: {
      mode: "automatic",
    },
  };
}

function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [setupName, setSetupName] = useState("");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("editor");
  const [importJson, setImportJson] = useState("");
  const [output, setOutput] = useState("{}");

  const activeRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === activeRecipeId) ?? null,
    [activeRecipeId, recipes],
  );

  const selectedAction = useMemo(() => {
    if (!activeRecipe) return null;
    return activeRecipe.actions.find((action) => action.id === selectedActionId) ?? activeRecipe.actions[0] ?? null;
  }, [activeRecipe, selectedActionId]);

  useEffect(() => {
    loadRecipes().catch((error) => setOutput(error.message));
  }, []);

  useEffect(() => {
    setSetupName(activeRecipe?.name ?? "");
    if (!activeRecipe) {
      setSelectedActionId(null);
      return;
    }
    if (activeRecipe.actions.length === 0) {
      setSelectedActionId(null);
      return;
    }
    if (!selectedActionId || !activeRecipe.actions.some((action) => action.id === selectedActionId)) {
      setSelectedActionId(activeRecipe.actions[0].id);
    }
  }, [activeRecipe?.id, activeRecipe?.name, activeRecipe?.actions, selectedActionId]);

  async function loadRecipes(selectRecipeId = activeRecipeId) {
    const loaded = await api<Recipe[]>("/recipes");
    setRecipes(loaded);
    if (selectRecipeId && loaded.some((recipe) => recipe.id === selectRecipeId)) {
      setActiveRecipeId(selectRecipeId);
    } else if (!selectRecipeId && loaded.length > 0) {
      setActiveRecipeId(loaded[0].id);
    }
  }

  function applyRecipe(recipe: Recipe) {
    setRecipes((current) => current.map((candidate) => (candidate.id === recipe.id ? recipe : candidate)));
    setActiveRecipeId(recipe.id);
  }

  async function createRecipe(event: FormEvent) {
    event.preventDefault();
    try {
      const recipe = await api<Recipe>("/recipes", {
        method: "POST",
        body: JSON.stringify({ name: recipeName }),
      });
      setRecipeName("");
      setSelectedActionId(null);
      await loadRecipes(recipe.id);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function renameRecipe(event: FormEvent) {
    event.preventDefault();
    if (!activeRecipe) return;
    try {
      const recipe = await api<Recipe>(`/recipes/${activeRecipe.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: setupName }),
      });
      applyRecipe(recipe);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function addAction(type: RecipeAction["type"]) {
    if (!activeRecipe) return;
    try {
      const recipe = await api<Recipe>(`/recipes/${activeRecipe.id}/actions`, {
        method: "POST",
        body: JSON.stringify(defaultAction(type)),
      });
      const addedAction = recipe.actions[recipe.actions.length - 1];
      applyRecipe(recipe);
      setSelectedActionId(addedAction?.id ?? null);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function updateAction(action: RecipeAction) {
    if (!activeRecipe) return;
    try {
      const recipe = await api<Recipe>(`/recipes/${activeRecipe.id}/actions/${action.id}`, {
        method: "PATCH",
        body: JSON.stringify(action),
      });
      applyRecipe(recipe);
      setSelectedActionId(action.id);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function moveAction(actionId: string, position: number) {
    if (!activeRecipe) return;
    try {
      const recipe = await api<Recipe>(`/recipes/${activeRecipe.id}/actions/${actionId}/move`, {
        method: "POST",
        body: JSON.stringify({ position }),
      });
      applyRecipe(recipe);
      setSelectedActionId(actionId);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function removeAction(actionId: string) {
    if (!activeRecipe) return;
    try {
      const recipe = await api<Recipe>(`/recipes/${activeRecipe.id}/actions/${actionId}`, {
        method: "DELETE",
      });
      applyRecipe(recipe);
      setSelectedActionId(recipe.actions[0]?.id ?? null);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function exportRecipe() {
    if (!activeRecipe) return;
    try {
      const document = await api<RecipeDocument>(`/recipes/${activeRecipe.id}/export`);
      const formatted = JSON.stringify(document, null, 2);
      setImportJson(formatted);
      setOutput(formatted);
      setWorkspaceView("json");
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function validateRecipe() {
    if (!activeRecipe) return;
    try {
      const validation = await api(`/recipes/${activeRecipe.id}/validate`, { method: "POST" });
      setOutput(JSON.stringify(validation, null, 2));
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function importRecipe() {
    try {
      const document = JSON.parse(importJson);
      const recipe = await api<Recipe>("/recipes/import", {
        method: "POST",
        body: JSON.stringify(document),
      });
      setSelectedActionId(recipe.actions[0]?.id ?? null);
      await loadRecipes(recipe.id);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function previewCommands(vendor: "company_a" | "company_b") {
    if (!activeRecipe) return;
    try {
      const preview = await api(
        `/recipes/${activeRecipe.id}/robot-commands/preview?vendor=${vendor}`,
        { method: "POST" },
      );
      setOutput(JSON.stringify(preview, null, 2));
      setWorkspaceView("preview");
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  return (
    <main className="app-shell bg-body-tertiary min-vh-100">
      <nav className="navbar navbar-expand bg-white border-bottom sticky-top">
        <div className="container-fluid px-4">
          <div>
            <span className="navbar-brand mb-0 h1">r3-recipe-manager</span>
            <span className="text-secondary small d-block">Vendor-neutral robot recipes</span>
          </div>
          <a className="btn btn-outline-primary btn-sm" href={API_DOCS_URL} target="_blank" rel="noreferrer">
            API docs
          </a>
        </div>
      </nav>

      <div className="container-fluid p-4">
        <div className="row g-4">
          <aside className="col-12 col-xl-3">
            <div className={`card shadow-sm state-card ${activeRecipe ? "" : "state-card-current"}`}>
              <div className="card-header bg-white">
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <h2 className="h5 mb-0">Recipes</h2>
                  {!activeRecipe ? <span className="badge text-bg-primary">Start here</span> : null}
                </div>
              </div>
              <div className="card-body">
                <form className="vstack gap-2" onSubmit={createRecipe}>
                  <label className="form-label mb-0" htmlFor="new-recipe-name">
                    New recipe
                  </label>
                  <input
                    id="new-recipe-name"
                    className="form-control"
                    required
                    maxLength={120}
                    placeholder="Battery screw removal"
                    value={recipeName}
                    onChange={(event) => setRecipeName(event.target.value)}
                  />
                  <button className="btn btn-primary" type="submit">
                    Create recipe
                  </button>
                </form>
              </div>
              <div className="list-group list-group-flush recipe-list">
                {recipes.length > 0 ? (
                  recipes.map((recipe) => (
                    <button
                      className={`list-group-item list-group-item-action ${recipe.id === activeRecipeId ? "active" : ""}`}
                      key={recipe.id}
                      onClick={() => {
                        setActiveRecipeId(recipe.id);
                        setSelectedActionId(recipe.actions[0]?.id ?? null);
                      }}
                    >
                      <span className="d-block fw-semibold text-truncate">{recipe.name}</span>
                      <span className="badge text-bg-light mt-2">{recipe.actions.length} actions</span>
                    </button>
                  ))
                ) : (
                  <div className="list-group-item text-secondary">No recipes yet.</div>
                )}
              </div>
            </div>
          </aside>

          <section className="col-12 col-xl-9">
            <div className="card shadow-sm workspace-card">
              <div className="card-header bg-white">
                <div className="d-flex flex-column flex-lg-row gap-3 justify-content-between align-items-lg-center">
                  <div>
                    <h2 className="h4 mb-1">{activeRecipe?.name ?? "Select a recipe"}</h2>
                    <span className="text-secondary">
                      {activeRecipe ? `${activeRecipe.actions.length} ordered actions` : "Create or select a recipe to begin."}
                    </span>
                  </div>
                  <div className="btn-toolbar gap-2">
                    <button className="btn btn-outline-success" disabled={!activeRecipe} onClick={validateRecipe}>
                      Validate
                    </button>
                    <button className="btn btn-outline-primary" disabled={!activeRecipe} onClick={exportRecipe}>
                      Export JSON
                    </button>
                  </div>
                </div>
              </div>

              <div className="card-body">
                <ul className="nav nav-pills mb-4" aria-label="Recipe workspace">
                  <li className="nav-item">
                    <button className={`nav-link ${workspaceView === "editor" ? "active" : ""}`} onClick={() => setWorkspaceView("editor")}>
                      Editor
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link ${workspaceView === "preview" ? "active" : ""}`} onClick={() => setWorkspaceView("preview")}>
                      Adapter Preview
                    </button>
                  </li>
                  <li className="nav-item">
                    <button className={`nav-link ${workspaceView === "json" ? "active" : ""}`} onClick={() => setWorkspaceView("json")}>
                      Recipe JSON
                    </button>
                  </li>
                </ul>

                {workspaceView === "editor" ? (
                  <EditorView
                    activeRecipe={activeRecipe}
                    setupName={setupName}
                    selectedAction={selectedAction}
                    selectedActionId={selectedAction?.id ?? null}
                    onSetupNameChange={setSetupName}
                    onRenameRecipe={renameRecipe}
                    onAddAction={addAction}
                    onSelectAction={setSelectedActionId}
                    onMoveAction={moveAction}
                    onRemoveAction={removeAction}
                    onUpdateAction={updateAction}
                  />
                ) : null}

                {workspaceView === "preview" ? <PreviewView activeRecipe={activeRecipe} output={output} onPreviewCommands={previewCommands} /> : null}

                {workspaceView === "json" ? <JsonView importJson={importJson} output={output} onImportJsonChange={setImportJson} onImportRecipe={importRecipe} /> : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function EditorView({
  activeRecipe,
  setupName,
  selectedAction,
  selectedActionId,
  onSetupNameChange,
  onRenameRecipe,
  onAddAction,
  onSelectAction,
  onMoveAction,
  onRemoveAction,
  onUpdateAction,
}: {
  activeRecipe: Recipe | null;
  setupName: string;
  selectedAction: RecipeAction | null;
  selectedActionId: string | null;
  onSetupNameChange: (name: string) => void;
  onRenameRecipe: (event: FormEvent) => void;
  onAddAction: (type: RecipeAction["type"]) => void;
  onSelectAction: (actionId: string) => void;
  onMoveAction: (actionId: string, position: number) => void;
  onRemoveAction: (actionId: string) => void;
  onUpdateAction: (action: RecipeAction) => void;
}) {
  return (
    <div className="vstack gap-4">
      <WorkflowGuide activeRecipe={activeRecipe} selectedAction={selectedAction} />

      <div className="row g-4 align-items-start">
        <section className="col-12 col-xxl-4">
          <div className={`card h-100 border-primary-subtle state-card ${activeRecipe ? "state-card-current" : "state-card-disabled"}`}>
            <SectionHeading number="1" title="Setup" badge={activeRecipe ? "Editable" : "Select recipe"} />
            <div className="card-body">
              <form className="vstack gap-3" onSubmit={onRenameRecipe}>
                <div>
                  <label className="form-label" htmlFor="setup-name">
                    Recipe name
                  </label>
                  <input
                    id="setup-name"
                    className="form-control"
                    required
                    maxLength={120}
                    disabled={!activeRecipe}
                    value={setupName}
                    onChange={(event) => onSetupNameChange(event.target.value)}
                  />
                </div>
                <div className="unavailable-control rounded border p-2">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                    <label className="form-label mb-0" htmlFor="battery-layout">
                      Battery layout
                    </label>
                    <span className="badge text-bg-secondary">Outlook</span>
                  </div>
                  <input id="battery-layout" className="form-control" disabled placeholder="Pack variant or layout reference" />
                </div>
                <div className="unavailable-control rounded border p-2">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                    <label className="form-label mb-0" htmlFor="process-constraint">
                      Process constraint
                    </label>
                    <span className="badge text-bg-secondary">Outlook</span>
                  </div>
                  <input id="process-constraint" className="form-control" disabled placeholder="Station, tool, or customer constraint" />
                </div>
                <button className="btn btn-primary" disabled={!activeRecipe} type="submit">
                  Save setup
                </button>
              </form>
            </div>
          </div>
        </section>

        <section className="col-12 col-xxl-4">
          <div className={`card h-100 border-primary-subtle state-card ${activeRecipe ? "state-card-current" : "state-card-disabled"}`}>
            <SectionHeading number="2" title="Action List" badge={activeRecipe ? "Add or reorder" : "Select recipe"} />
            <div className="card-body">
              <div className="btn-group w-100 mb-3" role="group" aria-label="Add action">
                <button className="btn btn-outline-primary" disabled={!activeRecipe} onClick={() => onAddAction("take_image")}>
                  Take Image
                </button>
                <button className="btn btn-outline-primary" disabled={!activeRecipe} onClick={() => onAddAction("unscrewing")}>
                  Unscrewing
                </button>
              </div>
              <div className="list-group action-list">
                {activeRecipe ? (
                  activeRecipe.actions.length > 0 ? (
                    activeRecipe.actions.map((action, index) => (
                      <ActionRow
                        key={action.id}
                        index={index}
                        action={action}
                        selected={action.id === selectedActionId}
                        isFirst={index === 0}
                        isLast={index === activeRecipe.actions.length - 1}
                        onSelect={onSelectAction}
                        onMove={onMoveAction}
                        onRemove={onRemoveAction}
                      />
                    ))
                  ) : (
                    <EmptyState label="No actions yet." />
                  )
                ) : (
                  <EmptyState label="No recipe selected." />
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="col-12 col-xxl-4">
          <div className={`card h-100 border-primary-subtle state-card ${selectedAction ? "state-card-current" : "state-card-disabled"}`}>
            <SectionHeading number="3" title="Action Configuration" badge={selectedAction ? actionLabel(selectedAction) : "Select action"} />
            <div className="card-body">
              {selectedAction ? <ActionConfiguration action={selectedAction} onUpdate={onUpdateAction} /> : <EmptyState label="Add or select an action to configure it." />}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function WorkflowGuide({ activeRecipe, selectedAction }: { activeRecipe: Recipe | null; selectedAction: RecipeAction | null }) {
  const currentLabel = !activeRecipe ? "Setup" : activeRecipe.actions.length === 0 ? "Actions" : selectedAction ? "Configure" : "Actions";
  const items = [
    { label: "Setup", done: Boolean(activeRecipe?.name), current: currentLabel === "Setup" },
    { label: "Actions", done: Boolean(activeRecipe && activeRecipe.actions.length > 0), current: currentLabel === "Actions" },
    { label: "Configure", done: Boolean(selectedAction), current: currentLabel === "Configure" },
  ];

  return (
    <div className="card bg-primary-subtle border-0 workflow-guide">
      <div className="card-body py-3">
        <div className="row g-2">
          {items.map((item, index) => (
            <div className="col-12 col-md-4" key={item.label}>
              <div className={`workflow-step ${item.done ? "complete" : ""} ${item.current ? "current" : ""}`}>
                <span className="badge rounded-pill text-bg-primary">{index + 1}</span>
                <span className="fw-semibold">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewView({
  activeRecipe,
  output,
  onPreviewCommands,
}: {
  activeRecipe: Recipe | null;
  output: string;
  onPreviewCommands: (vendor: "company_a" | "company_b") => void;
}) {
  return (
    <div className={`card border-primary-subtle state-card ${activeRecipe ? "state-card-current" : "state-card-disabled"}`}>
      <SectionHeading number="4" title="Adapter Preview" badge={activeRecipe ? "Command plan" : "Select recipe"} />
      <div className="card-body">
        <div className="btn-group mb-3" role="group" aria-label="Vendor preview">
          <button className="btn btn-outline-primary" disabled={!activeRecipe} onClick={() => onPreviewCommands("company_a")}>
            Company A
          </button>
          <button className="btn btn-outline-primary" disabled={!activeRecipe} onClick={() => onPreviewCommands("company_b")}>
            Company B
          </button>
        </div>
        <pre className="code-output mb-0">{output}</pre>
      </div>
    </div>
  );
}

function JsonView({
  importJson,
  output,
  onImportJsonChange,
  onImportRecipe,
}: {
  importJson: string;
  output: string;
  onImportJsonChange: (value: string) => void;
  onImportRecipe: () => void;
}) {
  return (
    <div className="row g-4">
      <section className="col-12 col-lg-6">
        <div className="card h-100 border-primary-subtle">
          <SectionHeading number="5" title="Recipe JSON" badge="Import" />
          <div className="card-body vstack gap-3">
            <textarea
              className="form-control code-input"
              rows={14}
              spellCheck={false}
              value={importJson}
              onChange={(event) => onImportJsonChange(event.target.value)}
            />
            <button className="btn btn-primary align-self-start" onClick={onImportRecipe}>
              Import
            </button>
          </div>
        </div>
      </section>
      <section className="col-12 col-lg-6">
        <div className="card h-100 border-primary-subtle">
          <SectionHeading number="6" title="Output" badge="JSON" />
          <div className="card-body">
            <pre className="code-output mb-0">{output}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ number, title, badge }: { number: string; title: string; badge: string }) {
  return (
    <div className="card-header bg-white d-flex align-items-center justify-content-between gap-3">
      <div className="d-flex align-items-center gap-2">
        <span className="badge rounded-pill text-bg-primary">{number}</span>
        <h3 className="h5 mb-0">{title}</h3>
      </div>
      <span className="badge text-bg-light">{badge}</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <div className="alert alert-light border mb-0 text-secondary">{label}</div>;
}

function ActionConfiguration({ action, onUpdate }: { action: RecipeAction; onUpdate: (action: RecipeAction) => void }) {
  if (action.type === "take_image") {
    const parameters = action.parameters;
    return (
      <div className="vstack gap-3">
        <fieldset className="border rounded p-3">
          <legend className="float-none w-auto px-2 fs-6 fw-semibold">Capture area</legend>
          <SegmentedControl
            value={parameters.image_scope}
            options={[
              { value: "full_battery", label: "Full battery" },
              { value: "section", label: "Specific section" },
            ]}
            onChange={(image_scope) => {
              onUpdate({
                ...action,
                parameters: {
                  ...parameters,
                  image_scope,
                  center: image_scope === "section" ? parameters.center ?? { x: 0, y: 0 } : undefined,
                },
              });
            }}
          />
          {parameters.image_scope === "section" ? (
            <div className="row g-3 mt-1">
              <div className="col-6">
                <CoordinateInput
                  label="Center X"
                  value={parameters.center?.x ?? 0}
                  onChange={(x) => onUpdate({ ...action, parameters: { ...parameters, center: { x, y: parameters.center?.y ?? 0 } } })}
                />
              </div>
              <div className="col-6">
                <CoordinateInput
                  label="Center Y"
                  value={parameters.center?.y ?? 0}
                  onChange={(y) => onUpdate({ ...action, parameters: { ...parameters, center: { x: parameters.center?.x ?? 0, y } } })}
                />
              </div>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="border rounded p-3">
          <legend className="float-none w-auto px-2 fs-6 fw-semibold">Depth data</legend>
          <SegmentedControl
            value={parameters.include_pointcloud ? "pointcloud" : "image_only"}
            options={[
              { value: "image_only", label: "2D image only" },
              { value: "pointcloud", label: "Image + point cloud" },
            ]}
            onChange={(mode) => onUpdate({ ...action, parameters: { ...parameters, include_pointcloud: mode === "pointcloud" } })}
          />
        </fieldset>
      </div>
    );
  }

  const parameters = action.parameters;
  return (
    <div className="vstack gap-3">
      <fieldset className="border rounded p-3">
        <legend className="float-none w-auto px-2 fs-6 fw-semibold">Targeting</legend>
        <SegmentedControl
          value={parameters.mode}
          options={[
            { value: "automatic", label: "Automatic detection" },
            { value: "specific", label: "Specific screw position" },
          ]}
          onChange={(mode) => {
            onUpdate({
              ...action,
              parameters: {
                ...parameters,
                mode,
                target: mode === "specific" ? parameters.target ?? { x: 0, y: 0 } : undefined,
              },
            });
          }}
        />
        {parameters.mode === "specific" ? (
          <div className="row g-3 mt-1">
            <div className="col-6">
              <CoordinateInput
                label="Target X"
                value={parameters.target?.x ?? 0}
                onChange={(x) => onUpdate({ ...action, parameters: { ...parameters, target: { x, y: parameters.target?.y ?? 0 } } })}
              />
            </div>
            <div className="col-6">
              <CoordinateInput
                label="Target Y"
                value={parameters.target?.y ?? 0}
                onChange={(y) => onUpdate({ ...action, parameters: { ...parameters, target: { x: parameters.target?.x ?? 0, y } } })}
              />
            </div>
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="btn-group w-100 segmented-control" role="group">
      {options.map((option) => (
        <button
          className={`btn ${option.value === value ? "btn-primary" : "btn-outline-primary"}`}
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CoordinateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="form-label w-100">
      {label}
      <input className="form-control mt-1" type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function ActionRow({
  index,
  action,
  selected,
  isFirst,
  isLast,
  onSelect,
  onMove,
  onRemove,
}: {
  index: number;
  action: RecipeAction;
  selected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: (actionId: string) => void;
  onMove: (actionId: string, position: number) => void;
  onRemove: (actionId: string) => void;
}) {
  return (
    <div className={`list-group-item ${selected ? "active" : ""}`}>
      <button className={`btn action-select ${selected ? "text-white" : "text-body"}`} onClick={() => onSelect(action.id)}>
        <span className="fw-semibold d-block">
          {index + 1}. {actionLabel(action)}
        </span>
        <span className={`small d-block ${selected ? "text-white-50" : "text-secondary"}`}>{actionSummary(action)}</span>
      </button>
      <div className="btn-group btn-group-sm mt-2" role="group" aria-label="Action ordering">
        <button className="btn btn-outline-secondary" disabled={isFirst} onClick={() => onMove(action.id, index - 1)}>
          Up
        </button>
        <button className="btn btn-outline-secondary" disabled={isLast} onClick={() => onMove(action.id, index + 1)}>
          Down
        </button>
        <button className="btn btn-outline-danger" onClick={() => onRemove(action.id)}>
          Remove
        </button>
      </div>
    </div>
  );
}

function actionLabel(action: RecipeAction): string {
  return action.type === "take_image" ? "Take image" : "Unscrewing";
}

function actionSummary(action: RecipeAction): string {
  if (action.type === "take_image") {
    const scope = action.parameters.image_scope === "full_battery" ? "full battery" : `section at ${formatCoordinate(action.parameters.center)}`;
    return `${scope}${action.parameters.include_pointcloud ? " with point cloud" : ""}`;
  }
  if (action.parameters.mode === "automatic") return "automatic target detection";
  return `target ${formatCoordinate(action.parameters.target)}`;
}

function formatCoordinate(coordinate?: Coordinate): string {
  if (!coordinate) return "x=0, y=0";
  return `x=${coordinate.x}, y=${coordinate.y}`;
}

createRoot(document.getElementById("root")!).render(<App />);
