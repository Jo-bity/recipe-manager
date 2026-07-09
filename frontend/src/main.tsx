import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
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
    <main className="shell">
      <section className="topbar">
        <div>
          <h1>r3-recipe-manager</h1>
          <p>Create technician-safe robot recipes and export vendor-neutral Recipe JSON.</p>
        </div>
        <a href={API_DOCS_URL} target="_blank" rel="noreferrer">
          API docs
        </a>
      </section>

      <section className="layout">
        <aside className="panel sidebar">
          <h2>Recipes</h2>
          <form className="stack" onSubmit={createRecipe}>
            <label>
              Recipe name
              <input
                required
                maxLength={120}
                placeholder="Battery screw removal"
                value={recipeName}
                onChange={(event) => setRecipeName(event.target.value)}
              />
            </label>
            <button type="submit">Create recipe</button>
          </form>
          <div className="list">
            {recipes.map((recipe) => (
              <button
                className={`recipe-row ${recipe.id === activeRecipeId ? "active" : ""}`}
                key={recipe.id}
                onClick={() => {
                  setActiveRecipeId(recipe.id);
                  setSelectedActionId(recipe.actions[0]?.id ?? null);
                }}
              >
                <span>{recipe.name}</span>
                <span>{recipe.actions.length} actions</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel workspace">
          <div className="workspace-header">
            <div>
              <h2>{activeRecipe?.name ?? "Select a recipe"}</h2>
              <p>
                {activeRecipe
                  ? `${activeRecipe.actions.length} ordered actions`
                  : "Create or select a recipe to begin."}
              </p>
            </div>
            <div className="actions">
              <button disabled={!activeRecipe} onClick={validateRecipe}>
                Validate
              </button>
              <button disabled={!activeRecipe} onClick={exportRecipe}>
                Export JSON
              </button>
            </div>
          </div>

          <nav className="tabs" aria-label="Recipe workspace">
            <button className={workspaceView === "editor" ? "active" : ""} onClick={() => setWorkspaceView("editor")}>
              Editor
            </button>
            <button className={workspaceView === "preview" ? "active" : ""} onClick={() => setWorkspaceView("preview")}>
              Adapter Preview
            </button>
            <button className={workspaceView === "json" ? "active" : ""} onClick={() => setWorkspaceView("json")}>
              Recipe JSON
            </button>
          </nav>

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

          {workspaceView === "preview" ? (
            <PreviewView activeRecipe={activeRecipe} output={output} onPreviewCommands={previewCommands} />
          ) : null}

          {workspaceView === "json" ? (
            <JsonView importJson={importJson} output={output} onImportJsonChange={setImportJson} onImportRecipe={importRecipe} />
          ) : null}
        </section>
      </section>
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
    <div className="editor-grid">
      <section className="setup-section">
        <SectionHeading eyebrow="Setup" title="Recipe purpose" />
        <form className="setup-form" onSubmit={onRenameRecipe}>
          <label>
            Recipe name
            <input
              required
              maxLength={120}
              disabled={!activeRecipe}
              value={setupName}
              onChange={(event) => onSetupNameChange(event.target.value)}
            />
          </label>
          <label>
            Battery layout
            <input disabled placeholder="Outlook: pack variant or layout reference" />
          </label>
          <label>
            Process constraint
            <input disabled placeholder="Outlook: station, tool, or customer constraint" />
          </label>
          <button disabled={!activeRecipe} type="submit">
            Save setup
          </button>
        </form>
      </section>

      <section className="action-list-section">
        <SectionHeading eyebrow="Action List" title="Robot procedure" />
        <div className="add-actions">
          <button disabled={!activeRecipe} onClick={() => onAddAction("take_image")}>
            Add Take Image
          </button>
          <button disabled={!activeRecipe} onClick={() => onAddAction("unscrewing")}>
            Add Unscrewing
          </button>
        </div>
        <div className="action-list">
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
              <p className="empty-state">No actions yet.</p>
            )
          ) : (
            <p className="empty-state">No recipe selected.</p>
          )}
        </div>
      </section>

      <section className="configuration-section">
        <SectionHeading eyebrow="Action Configuration" title={selectedAction ? actionLabel(selectedAction) : "Select an action"} />
        {selectedAction ? <ActionConfiguration action={selectedAction} onUpdate={onUpdateAction} /> : <p className="empty-state">Add or select an action to configure it.</p>}
      </section>
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
    <div className="workspace-page">
      <SectionHeading eyebrow="Adapter Preview" title="Vendor command plan" />
      <div className="preview-actions">
        <button disabled={!activeRecipe} onClick={() => onPreviewCommands("company_a")}>
          Company A
        </button>
        <button disabled={!activeRecipe} onClick={() => onPreviewCommands("company_b")}>
          Company B
        </button>
      </div>
      <pre>{output}</pre>
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
    <div className="json-grid">
      <section>
        <SectionHeading eyebrow="Recipe JSON" title="Import" />
        <textarea
          rows={14}
          spellCheck={false}
          value={importJson}
          onChange={(event) => onImportJsonChange(event.target.value)}
        />
        <button onClick={onImportRecipe}>Import</button>
      </section>
      <section>
        <SectionHeading eyebrow="Recipe JSON" title="Output" />
        <pre>{output}</pre>
      </section>
    </div>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="section-heading">
      <span>{eyebrow}</span>
      <h3>{title}</h3>
    </div>
  );
}

function ActionConfiguration({ action, onUpdate }: { action: RecipeAction; onUpdate: (action: RecipeAction) => void }) {
  if (action.type === "take_image") {
    const parameters = action.parameters;
    return (
      <div className="configuration-form">
        <fieldset>
          <legend>Capture area</legend>
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
            <div className="field-grid">
              <CoordinateInput
                label="Center X"
                value={parameters.center?.x ?? 0}
                onChange={(x) => onUpdate({ ...action, parameters: { ...parameters, center: { x, y: parameters.center?.y ?? 0 } } })}
              />
              <CoordinateInput
                label="Center Y"
                value={parameters.center?.y ?? 0}
                onChange={(y) => onUpdate({ ...action, parameters: { ...parameters, center: { x: parameters.center?.x ?? 0, y } } })}
              />
            </div>
          ) : null}
        </fieldset>

        <fieldset>
          <legend>Depth data</legend>
          <SegmentedControl
            value={parameters.include_pointcloud ? "pointcloud" : "image_only"}
            options={[
              { value: "image_only", label: "2D image only" },
              { value: "pointcloud", label: "Image + point cloud" },
            ]}
            onChange={(mode) => onUpdate({ ...action, parameters: { ...parameters, include_pointcloud: mode === "pointcloud" } })}
          />
          <p className="field-note">Point cloud adds depth information for 3D part location.</p>
        </fieldset>
      </div>
    );
  }

  const parameters = action.parameters;
  return (
    <div className="configuration-form">
      <fieldset>
        <legend>Targeting</legend>
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
          <div className="field-grid">
            <CoordinateInput
              label="Target X"
              value={parameters.target?.x ?? 0}
              onChange={(x) => onUpdate({ ...action, parameters: { ...parameters, target: { x, y: parameters.target?.y ?? 0 } } })}
            />
            <CoordinateInput
              label="Target Y"
              value={parameters.target?.y ?? 0}
              onChange={(y) => onUpdate({ ...action, parameters: { ...parameters, target: { x: parameters.target?.x ?? 0, y } } })}
            />
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
    <div className="segmented-control">
      {options.map((option) => (
        <button
          className={option.value === value ? "active" : ""}
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
    <label>
      {label}
      <input type="number" min={0} value={value} onChange={(event) => onChange(Number(event.target.value))} />
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
    <div className={`action-row ${selected ? "selected" : ""}`}>
      <button className="action-select" onClick={() => onSelect(action.id)}>
        <strong>
          {index + 1}. {actionLabel(action)}
        </strong>
        <span>{actionSummary(action)}</span>
      </button>
      <div className="icon-actions">
        <button disabled={isFirst} onClick={() => onMove(action.id, index - 1)}>
          Up
        </button>
        <button disabled={isLast} onClick={() => onMove(action.id, index + 1)}>
          Down
        </button>
        <button onClick={() => onRemove(action.id)}>Remove</button>
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
