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
type RecipeActionInput = Omit<TakeImageAction, "id"> | Omit<UnscrewingAction, "id">;
type EditableRecipeAction =
  | (Omit<TakeImageAction, "id"> & { id?: string })
  | (Omit<UnscrewingAction, "id"> & { id?: string });

type RecipeStep = {
  id: string;
  type: RecipeAction["type"];
  actions: RecipeAction[];
};

type RecipeStepInput = {
  type: RecipeAction["type"];
  actions: RecipeActionInput[];
};

type Recipe = {
  id: string;
  schema_version: "1.0";
  name: string;
  steps: RecipeStep[];
  created_at: string;
  updated_at: string;
};

type RecipeDocument = {
  schema_version: "1.0";
  name: string;
  steps: RecipeStep[];
};

type WorkspaceView = "editor" | "preview" | "json";
type ValidationFeedback = {
  status: "success" | "error";
  title: string;
  details: string[];
};
type IconName = "camera" | "wrench" | "scan" | "gripper" | "check" | "crop" | "layers" | "target";
type StepCatalogItem = {
  type?: RecipeAction["type"];
  icon: IconName;
  label: string;
  group: string;
  description: string;
  status: "available" | "planned";
};

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, "");
const API_DOCS_URL = `${API_BASE_URL || "http://localhost:8000"}/docs`;
const STEP_CATALOG: StepCatalogItem[] = [
  {
    type: "take_image",
    icon: "camera",
    label: "Take image",
    group: "Inspection",
    description: "Capture the full battery or a focused section before or after work.",
    status: "available",
  },
  {
    type: "unscrewing",
    icon: "wrench",
    label: "Unscrewing",
    group: "Fastener removal",
    description: "Remove screws automatically or at a specific coordinate.",
    status: "available",
  },
  {
    icon: "scan",
    label: "Detect screws",
    group: "Inspection",
    description: "Locate screw candidates from an image before removal.",
    status: "planned",
  },
  {
    icon: "gripper",
    label: "Pick component",
    group: "Handling",
    description: "Pick a loosened battery component from a known position.",
    status: "planned",
  },
  {
    icon: "check",
    label: "Verify removal",
    group: "Inspection",
    description: "Capture proof that the target screw or component was removed.",
    status: "planned",
  },
];

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

function defaultAction(type: RecipeAction["type"], includePointcloud = false): RecipeActionInput {
  if (type === "take_image") {
    return {
      type: "take_image",
      parameters: {
        include_pointcloud: includePointcloud,
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

function stepInputFromAction(action: RecipeActionInput): RecipeStepInput {
  return { type: action.type, actions: [action] };
}

function recipeFileName(recipeName: string) {
  const slug = recipeName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "recipe"}.json`;
}

function actionIcon(action: RecipeAction): IconName {
  return action.type === "take_image" ? "camera" : "wrench";
}

function Icon({ name }: { name: IconName }) {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {name === "camera" ? (
        <>
          <path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v9.5H4z" />
          <circle cx="12" cy="13" r="3.2" />
        </>
      ) : null}
      {name === "wrench" ? (
        <path d="M15.6 5.2a4.2 4.2 0 0 0 3.2 5.1l-8.5 8.5a2.4 2.4 0 0 1-3.4-3.4l8.5-8.5a4.2 4.2 0 0 0 .2-1.7z" />
      ) : null}
      {name === "scan" ? (
        <>
          <path d="M5 8V5h3" />
          <path d="M16 5h3v3" />
          <path d="M19 16v3h-3" />
          <path d="M8 19H5v-3" />
          <path d="M8 12h8" />
        </>
      ) : null}
      {name === "gripper" ? (
        <>
          <path d="M8 4v7" />
          <path d="M16 4v7" />
          <path d="M8 11l-3 5 3 4" />
          <path d="M16 11l3 5-3 4" />
          <path d="M10 14h4" />
        </>
      ) : null}
      {name === "check" ? <path d="M5 12.5l4.2 4.2L19 7" /> : null}
      {name === "crop" ? (
        <>
          <path d="M7 3v14h14" />
          <path d="M3 7h14v14" />
        </>
      ) : null}
      {name === "layers" ? (
        <>
          <path d="M12 4l8 4-8 4-8-4z" />
          <path d="M4 12l8 4 8-4" />
          <path d="M4 16l8 4 8-4" />
        </>
      ) : null}
      {name === "target" ? (
        <>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2.5" />
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
        </>
      ) : null}
    </svg>
  );
}

function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [setupName, setSetupName] = useState("");
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("editor");
  const [importJson, setImportJson] = useState("");
  const [output, setOutput] = useState("{}");
  const [validationFeedback, setValidationFeedback] = useState<ValidationFeedback | null>(null);

  const activeRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === activeRecipeId) ?? null,
    [activeRecipeId, recipes],
  );

  const selectedStep = useMemo(() => {
    if (!activeRecipe) return null;
    return activeRecipe.steps.find((step) => step.id === selectedStepId) ?? activeRecipe.steps[0] ?? null;
  }, [activeRecipe, selectedStepId]);

  const selectedAction = selectedStep?.actions[0] ?? null;

  useEffect(() => {
    loadRecipes().catch((error) => setOutput(error.message));
  }, []);

  useEffect(() => {
    setSetupName(activeRecipe?.name ?? "");
    if (!activeRecipe) {
      setSelectedStepId(null);
      return;
    }
    if (activeRecipe.steps.length === 0) {
      setSelectedStepId(null);
      return;
    }
    if (!selectedStepId || !activeRecipe.steps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(activeRecipe.steps[0].id);
    }
  }, [activeRecipe?.id, activeRecipe?.name, activeRecipe?.steps, selectedStepId]);

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
    setValidationFeedback(null);
  }

  async function createRecipe(event: FormEvent) {
    event.preventDefault();
    try {
      const recipe = await api<Recipe>("/recipes", {
        method: "POST",
        body: JSON.stringify({ name: recipeName }),
      });
      setRecipeName("");
      setSelectedStepId(null);
      setValidationFeedback(null);
      await loadRecipes(recipe.id);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  function startNewRecipe() {
    setActiveRecipeId(null);
    setSelectedStepId(null);
    setSetupName("");
    setRecipeName("");
    setWorkspaceView("editor");
    setValidationFeedback(null);
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

  async function addStep(action: RecipeActionInput) {
    if (!activeRecipe) return;
    try {
      const recipe = await api<Recipe>(`/recipes/${activeRecipe.id}/steps`, {
        method: "POST",
        body: JSON.stringify(stepInputFromAction(action)),
      });
      const addedStep = recipe.steps[recipe.steps.length - 1];
      applyRecipe(recipe);
      setSelectedStepId(addedStep?.id ?? null);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function updateSelectedStepAction(action: RecipeAction) {
    if (!activeRecipe || !selectedStep) return;
    try {
      const updatedStep: RecipeStep = { ...selectedStep, actions: [action, ...selectedStep.actions.slice(1)] };
      const recipe = await api<Recipe>(`/recipes/${activeRecipe.id}/steps/${selectedStep.id}`, {
        method: "PATCH",
        body: JSON.stringify(updatedStep),
      });
      applyRecipe(recipe);
      setSelectedStepId(selectedStep.id);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function moveStep(stepId: string, position: number) {
    if (!activeRecipe) return;
    try {
      const recipe = await api<Recipe>(`/recipes/${activeRecipe.id}/steps/${stepId}/move`, {
        method: "POST",
        body: JSON.stringify({ position }),
      });
      applyRecipe(recipe);
      setSelectedStepId(stepId);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function removeStep(stepId: string) {
    if (!activeRecipe) return;
    try {
      const recipe = await api<Recipe>(`/recipes/${activeRecipe.id}/steps/${stepId}`, {
        method: "DELETE",
      });
      applyRecipe(recipe);
      setSelectedStepId(recipe.steps[0]?.id ?? null);
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
      const formatted = JSON.stringify(validation, null, 2);
      setValidationFeedback({
        status: "success",
        title: "Recipe is valid for export and adapter preview.",
        details: [`${activeRecipe.steps.length} ordered step${activeRecipe.steps.length === 1 ? "" : "s"} validated.`],
      });
      setOutput(formatted);
    } catch (error) {
      setValidationFeedback(validationFeedbackFromError(error as Error));
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
      setSelectedStepId(recipe.steps[0]?.id ?? null);
      setValidationFeedback(null);
      await loadRecipes(recipe.id);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  function downloadRecipeJson() {
    if (!importJson.trim()) return;
    const blob = new Blob([importJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = recipeFileName(activeRecipe?.name ?? "recipe");
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
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
          <section className="col-12">
            <div className="card shadow-sm workspace-card">
              <div className="card-header bg-white">
                <div className="d-flex flex-column flex-lg-row gap-3 justify-content-between align-items-lg-center">
                  <div>
                    <h2 className="h4 mb-1">{activeRecipe?.name ?? "Create a recipe"}</h2>
                    <span className="text-secondary">
                      {activeRecipe ? `${activeRecipe.steps.length} ordered steps` : "Use Setup to start the demo workflow."}
                    </span>
                  </div>
                  <div className="btn-toolbar gap-2">
                    <button className="btn btn-outline-secondary" disabled={!activeRecipe} onClick={startNewRecipe}>
                      New recipe
                    </button>
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

                {workspaceView === "editor" ? <ValidationFeedbackBanner feedback={validationFeedback} /> : null}

                {workspaceView === "editor" ? (
                  <EditorView
                    activeRecipe={activeRecipe}
                    recipeName={recipeName}
                    setupName={setupName}
                    selectedAction={selectedAction}
                    selectedStepId={selectedStep?.id ?? null}
                    onRecipeNameChange={setRecipeName}
                    onCreateRecipe={createRecipe}
                    onSetupNameChange={setSetupName}
                    onRenameRecipe={renameRecipe}
                    onAddStep={addStep}
                    onSelectStep={setSelectedStepId}
                    onMoveStep={moveStep}
                    onRemoveStep={removeStep}
                    onUpdateAction={updateSelectedStepAction}
                  />
                ) : null}

                {workspaceView === "preview" ? <PreviewView activeRecipe={activeRecipe} output={output} onPreviewCommands={previewCommands} /> : null}

                {workspaceView === "json" ? (
                  <JsonView
                    importJson={importJson}
                    output={output}
                    onImportJsonChange={setImportJson}
                    onImportRecipe={importRecipe}
                    onDownloadRecipeJson={downloadRecipeJson}
                  />
                ) : null}
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
  recipeName,
  setupName,
  selectedAction,
  selectedStepId,
  onRecipeNameChange,
  onCreateRecipe,
  onSetupNameChange,
  onRenameRecipe,
  onAddStep,
  onSelectStep,
  onMoveStep,
  onRemoveStep,
  onUpdateAction,
}: {
  activeRecipe: Recipe | null;
  recipeName: string;
  setupName: string;
  selectedAction: RecipeAction | null;
  selectedStepId: string | null;
  onRecipeNameChange: (name: string) => void;
  onCreateRecipe: (event: FormEvent) => void;
  onSetupNameChange: (name: string) => void;
  onRenameRecipe: (event: FormEvent) => void;
  onAddStep: (action: RecipeActionInput) => Promise<void>;
  onSelectStep: (stepId: string) => void;
  onMoveStep: (stepId: string, position: number) => void;
  onRemoveStep: (stepId: string) => void;
  onUpdateAction: (action: RecipeAction) => void;
}) {
  const [draftAction, setDraftAction] = useState<RecipeActionInput | null>(null);
  const displayedAction = draftAction ?? selectedAction;
  const isDrafting = Boolean(draftAction);

  useEffect(() => {
    setDraftAction(null);
  }, [activeRecipe?.id]);

  async function addConfiguredStep() {
    if (!draftAction) return;
    await onAddStep(draftAction);
    setDraftAction(null);
  }

  const canAddConfiguredStep = Boolean(activeRecipe && draftAction && isActionComplete(draftAction));

  return (
    <div className="vstack gap-4">
      <WorkflowGuide activeRecipe={activeRecipe} hasConfigSelection={Boolean(displayedAction)} />

      <div className="row g-4 align-items-start">
        <section className="col-12 col-xl-6 col-xxl-3">
          <div className="card h-100 border-primary-subtle state-card state-card-current">
            <SectionHeading number="1" title="Setup" badge={activeRecipe ? "Editable" : "Start here"} />
            <div className="card-body">
              {!activeRecipe ? (
                <form className="vstack gap-3" onSubmit={onCreateRecipe}>
                  <div>
                    <label className="form-label" htmlFor="new-recipe-name">
                      Recipe name
                    </label>
                    <input
                      id="new-recipe-name"
                      className="form-control"
                      required
                      maxLength={120}
                      placeholder="Battery screw removal"
                      value={recipeName}
                      onChange={(event) => onRecipeNameChange(event.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary" type="submit">
                    Create recipe
                  </button>
                </form>
              ) : (
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
              )}
            </div>
          </div>
        </section>

        <section className="col-12 col-xl-6 col-xxl-5">
          <div className={`card border-primary-subtle state-card workflow-config-card ${activeRecipe ? "state-card-current" : "state-card-disabled"}`}>
            <SectionHeading
              number="2"
              title="Step Configuration"
              badge={draftAction ? "New step" : selectedAction ? actionLabel(selectedAction) : "Select type"}
            />
            <div className="card-body">
              <div className="workflow-config-scroll vstack gap-3">
                <StepCatalog
                  activeRecipe={activeRecipe}
                  selectedType={draftAction?.type ?? null}
                  onSelectType={(type) => setDraftAction(defaultAction(type))}
                />
                {displayedAction ? (
                  <ActionConfiguration
                    action={displayedAction}
                    onUpdate={(action) => {
                      if (isDrafting) {
                        setDraftAction(action as RecipeActionInput);
                        return;
                      }
                      onUpdateAction(action as RecipeAction);
                    }}
                  />
                ) : (
                  <EmptyState label="Select a step type or an existing step to configure it." />
                )}
              </div>
              <button className="btn btn-primary w-100 workflow-config-action" disabled={!canAddConfiguredStep} onClick={addConfiguredStep} type="button">
                Add configured step
              </button>
            </div>
          </div>
        </section>

        <section className="col-12 col-xl-6 col-xxl-4">
          <div className={`card h-100 border-primary-subtle state-card ${activeRecipe ? "state-card-current" : "state-card-disabled"}`}>
            <SectionHeading number="3" title="Step List" badge={activeRecipe ? "Recipe order" : "Create recipe"} />
            <div className="card-body">
              <div className="list-group action-list">
                {activeRecipe ? (
                  activeRecipe.steps.length > 0 ? (
                    activeRecipe.steps.map((step, index) => (
                      <StepRow
                        key={step.id}
                        index={index}
                        step={step}
                        selected={!isDrafting && step.id === selectedStepId}
                        isFirst={index === 0}
                        isLast={index === activeRecipe.steps.length - 1}
                        onSelect={(stepId) => {
                          setDraftAction(null);
                          onSelectStep(stepId);
                        }}
                        onMove={onMoveStep}
                        onRemove={onRemoveStep}
                      />
                    ))
                  ) : (
                    <EmptyState label="No steps yet." />
                  )
                ) : (
                  <EmptyState label="Create a recipe in Setup first." />
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function WorkflowGuide({ activeRecipe, hasConfigSelection }: { activeRecipe: Recipe | null; hasConfigSelection: boolean }) {
  const currentLabel = !activeRecipe ? "Setup" : hasConfigSelection ? "Configure" : "List";
  const items = [
    { label: "Setup", done: Boolean(activeRecipe?.name), current: currentLabel === "Setup" },
    { label: "Configure", done: Boolean(hasConfigSelection), current: currentLabel === "Configure" },
    { label: "List", done: Boolean(activeRecipe && activeRecipe.steps.length > 0), current: currentLabel === "List" },
  ];

  return (
    <div className="card bg-primary-subtle border-0 workflow-guide">
      <div className="card-body py-3">
        <div className="row g-2">
          {items.map((item, index) => (
            <div
              className={`col-12 col-md-4 ${index === 0 ? "col-xxl-3" : ""} ${index === 1 ? "col-xxl-5" : ""} ${index === 2 ? "col-xxl-4" : ""}`}
              key={item.label}
            >
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
  onDownloadRecipeJson,
}: {
  importJson: string;
  output: string;
  onImportJsonChange: (value: string) => void;
  onImportRecipe: () => void;
  onDownloadRecipeJson: () => void;
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
            <div className="btn-toolbar gap-2">
              <button className="btn btn-primary" onClick={onImportRecipe}>
                Import
              </button>
              <button className="btn btn-outline-primary" disabled={!importJson.trim()} onClick={onDownloadRecipeJson}>
                Download JSON
              </button>
            </div>
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

function ValidationFeedbackBanner({ feedback }: { feedback: ValidationFeedback | null }) {
  if (!feedback) return null;
  const alertClass = feedback.status === "success" ? "alert-success" : "alert-danger";
  return (
    <div className={`alert ${alertClass} border mb-4`} role="status">
      <div className="fw-semibold">{feedback.title}</div>
      {feedback.details.length > 0 ? (
        <ul className="mb-0 mt-2 ps-3">
          {feedback.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StepCatalog({
  activeRecipe,
  selectedType,
  onSelectType,
}: {
  activeRecipe: Recipe | null;
  selectedType: RecipeAction["type"] | null;
  onSelectType: (type: RecipeAction["type"]) => void;
}) {
  const availableItems = STEP_CATALOG.filter((item) => item.status === "available" && item.type);
  const plannedItems = STEP_CATALOG.filter((item) => item.status === "planned");

  return (
    <fieldset className="border rounded p-3">
      <legend className="configuration-legend float-none w-auto px-2 fs-6 fw-semibold">
        <Icon name="check" />
        New step type
      </legend>
      <div className="step-catalog">
        {availableItems.map((item) => {
          const selectable = Boolean(activeRecipe && item.status === "available" && item.type);
          const selected = item.type === selectedType && item.status === "available";
          return (
            <button
              aria-pressed={selected}
              className={`step-type-card ${selected ? "step-type-card-selected" : ""} ${item.status === "planned" ? "step-type-card-planned" : ""}`}
              disabled={!selectable}
              key={item.label}
              onClick={() => item.type && onSelectType(item.type)}
              type="button"
            >
              <span className="step-type-card-header">
                <span className="step-type-title">
                  <span className="icon-shell">
                    <Icon name={item.icon} />
                  </span>
                  <span className="fw-semibold">{item.label}</span>
                </span>
                <span className={`badge ${item.status === "available" ? "text-bg-primary" : "text-bg-secondary"}`}>
                  {item.status === "available" ? item.group : "Outlook"}
                </span>
              </span>
              <span className="step-type-action">
                {item.status === "available" ? (selected ? "Configuring" : "Configure type") : "Planned"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="planned-step-strip mt-3">
        <span className="text-secondary small fw-semibold">Outlook:</span>
        {plannedItems.map((item) => (
          <span className="badge rounded-pill text-bg-secondary" key={item.label}>
            {item.label}
          </span>
        ))}
      </div>
    </fieldset>
  );
}

function ActionConfiguration({ action, onUpdate }: { action: EditableRecipeAction; onUpdate: (action: EditableRecipeAction) => void }) {
  if (action.type === "take_image") {
    const parameters = action.parameters;
    return (
      <div className="vstack gap-3">
        <ImageCapturePreview
          parameters={parameters}
          onSelectCenter={
            parameters.image_scope === "section"
              ? (center) => onUpdate({ ...action, parameters: { ...parameters, center } })
              : undefined
          }
        />
        <fieldset className="border rounded p-3">
          <legend className="configuration-legend float-none w-auto px-2 fs-6 fw-semibold">
            <Icon name="crop" />
            Image area
          </legend>
          <SegmentedControl
            value={parameters.image_scope}
            options={[
              { value: "full_battery", label: "Full battery image" },
              { value: "section", label: "Battery section image" },
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
                  label="Section center X"
                  value={parameters.center?.x ?? 0}
                  onChange={(x) => onUpdate({ ...action, parameters: { ...parameters, center: { x, y: parameters.center?.y ?? 0 } } })}
                />
              </div>
              <div className="col-6">
                <CoordinateInput
                  label="Section center Y"
                  value={parameters.center?.y ?? 0}
                  onChange={(y) => onUpdate({ ...action, parameters: { ...parameters, center: { x: parameters.center?.x ?? 0, y } } })}
                />
              </div>
            </div>
          ) : null}
        </fieldset>
        <fieldset className="border rounded p-3">
          <legend className="configuration-legend float-none w-auto px-2 fs-6 fw-semibold">
            <Icon name="layers" />
            Image output
          </legend>
          <SegmentedControl
            value={parameters.include_pointcloud ? "pointcloud" : "image_only"}
            options={[
              { value: "image_only", label: "2D image only" },
              { value: "pointcloud", label: "Image + point cloud" },
            ]}
            onChange={(mode) => onUpdate({ ...action, parameters: { ...parameters, include_pointcloud: mode === "pointcloud" } })}
          />
        </fieldset>
        <StepConfigurationOutlook type={action.type} />
      </div>
    );
  }

  const parameters = action.parameters;
  return (
    <div className="vstack gap-3">
      <UnscrewingPreview
        parameters={parameters}
        onSelectTarget={
          parameters.mode === "specific"
            ? (target) => onUpdate({ ...action, parameters: { ...parameters, target } })
            : undefined
        }
      />
      <fieldset className="border rounded p-3">
        <legend className="configuration-legend float-none w-auto px-2 fs-6 fw-semibold">
          <Icon name="target" />
          Unscrewing mode
        </legend>
        <SegmentedControl
          value={parameters.mode}
          options={[
            { value: "automatic", label: "Automatic unscrewing" },
            { value: "specific", label: "Specific unscrewing" },
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
                label="Screw target X"
                value={parameters.target?.x ?? 0}
                onChange={(x) => onUpdate({ ...action, parameters: { ...parameters, target: { x, y: parameters.target?.y ?? 0 } } })}
              />
            </div>
            <div className="col-6">
              <CoordinateInput
                label="Screw target Y"
                value={parameters.target?.y ?? 0}
                onChange={(y) => onUpdate({ ...action, parameters: { ...parameters, target: { x: parameters.target?.x ?? 0, y } } })}
              />
            </div>
          </div>
        ) : null}
      </fieldset>
      <StepConfigurationOutlook type={action.type} />
    </div>
  );
}

function StepConfigurationOutlook({ type }: { type: RecipeAction["type"] }) {
  const isImageStep = type === "take_image";
  return (
    <div className="unavailable-control rounded border p-2">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
        <label className="form-label mb-0" htmlFor={`step-outlook-${type}`}>
          {isImageStep ? "Image source" : "Tool profile"}
        </label>
        <span className="badge text-bg-secondary">Outlook</span>
      </div>
      <input
        id={`step-outlook-${type}`}
        className="form-control"
        disabled
        placeholder={isImageStep ? "Camera feed, exposure, annotation preset" : "Torque limit, bit type, force profile"}
      />
    </div>
  );
}

function ImageCapturePreview({
  parameters,
  onSelectCenter,
}: {
  parameters: TakeImageParameters;
  onSelectCenter?: (coordinate: Coordinate) => void;
}) {
  const center = parameters.center ?? { x: 50, y: 50 };
  const x = clampPercent(center.x);
  const y = clampPercent(center.y);
  const sectionStyle = {
    left: `${x}%`,
    top: `${y}%`,
  };
  const isSelectable = Boolean(onSelectCenter);

  return (
    <div className="configuration-preview">
      <div
        className={`battery-preview ${parameters.include_pointcloud ? "battery-preview-depth" : ""} ${isSelectable ? "battery-preview-selectable" : ""}`}
        onClick={(event) => onSelectCenter?.(coordinateFromPreview(event))}
        role={isSelectable ? "button" : undefined}
        tabIndex={isSelectable ? 0 : undefined}
      >
        <div className="battery-terminal battery-terminal-positive" />
        <div className="battery-terminal battery-terminal-negative" />
        <div className="battery-grid">
          {Array.from({ length: 18 }).map((_, index) => (
            <span className="battery-cell" key={index} />
          ))}
        </div>
        {parameters.image_scope === "section" ? (
          <>
            <div className="capture-section" style={sectionStyle} />
            <div className="capture-crosshair" style={sectionStyle} />
          </>
        ) : (
          <div className="capture-full-frame" />
        )}
        {parameters.include_pointcloud ? <div className="depth-layer" /> : null}
      </div>
      <div className="preview-caption">
        {parameters.image_scope === "section"
          ? `Section centered at ${formatCoordinate(parameters.center)}`
          : "Full battery capture"}
        {parameters.include_pointcloud ? " with depth data" : " as 2D image only"}
      </div>
    </div>
  );
}

function UnscrewingPreview({
  parameters,
  onSelectTarget,
}: {
  parameters: UnscrewingParameters;
  onSelectTarget?: (coordinate: Coordinate) => void;
}) {
  const target = parameters.target ?? { x: 50, y: 50 };
  const targetStyle = {
    left: `${clampPercent(target.x)}%`,
    top: `${clampPercent(target.y)}%`,
  };
  const isSelectable = Boolean(onSelectTarget);

  return (
    <div className="configuration-preview">
      <div
        className={`battery-preview ${isSelectable ? "battery-preview-selectable" : ""}`}
        onClick={(event) => onSelectTarget?.(coordinateFromPreview(event))}
        role={isSelectable ? "button" : undefined}
        tabIndex={isSelectable ? 0 : undefined}
      >
        <div className="battery-grid">
          {Array.from({ length: 18 }).map((_, index) => (
            <span className="battery-cell screw-cell" key={index} />
          ))}
        </div>
        {parameters.mode === "specific" ? (
          <div className="target-marker" style={targetStyle} />
        ) : (
          <div className="auto-detect-sweep" />
        )}
      </div>
      <div className="preview-caption">
        {parameters.mode === "specific"
          ? `Specific unscrewing at screw target ${formatCoordinate(parameters.target)}`
          : "Automatic unscrewing across detected screws"}
      </div>
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

function StepRow({
  index,
  step,
  selected,
  isFirst,
  isLast,
  onSelect,
  onMove,
  onRemove,
}: {
  index: number;
  step: RecipeStep;
  selected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: (stepId: string) => void;
  onMove: (stepId: string, position: number) => void;
  onRemove: (stepId: string) => void;
}) {
  const action = step.actions[0];
  return (
    <div className={`list-group-item ${selected ? "active" : ""}`}>
      <button className={`btn action-select ${selected ? "text-white" : "text-body"}`} onClick={() => onSelect(step.id)}>
        <span className="step-row-title">
          <span className="icon-shell">
            <Icon name={actionIcon(action)} />
          </span>
          <span className="fw-semibold">
            {index + 1}. {actionLabel(action)}
          </span>
        </span>
        <span className={`small d-block ${selected ? "text-white-50" : "text-secondary"}`}>{actionSummary(action)}</span>
      </button>
      <div className="btn-group btn-group-sm mt-2" role="group" aria-label="Step ordering">
        <button className="btn btn-outline-secondary" disabled={isFirst} onClick={() => onMove(step.id, index - 1)}>
          Up
        </button>
        <button className="btn btn-outline-secondary" disabled={isLast} onClick={() => onMove(step.id, index + 1)}>
          Down
        </button>
        <button className="btn btn-outline-danger" onClick={() => onRemove(step.id)}>
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
    const scope =
      action.parameters.image_scope === "full_battery" ? "full battery image" : `battery section image at ${formatCoordinate(action.parameters.center)}`;
    return `${scope}${action.parameters.include_pointcloud ? " with point cloud" : ""}`;
  }
  if (action.parameters.mode === "automatic") return "automatic unscrewing";
  return `specific unscrewing at ${formatCoordinate(action.parameters.target)}`;
}

function isActionComplete(action: EditableRecipeAction): boolean {
  if (action.type === "take_image") {
    if (action.parameters.image_scope === "full_battery") return true;
    return isNonNegativeCoordinate(action.parameters.center);
  }
  if (action.parameters.mode === "automatic") return true;
  return isNonNegativeCoordinate(action.parameters.target);
}

function isNonNegativeCoordinate(coordinate?: Coordinate): boolean {
  return Boolean(coordinate && coordinate.x >= 0 && coordinate.y >= 0);
}

function validationFeedbackFromError(error: Error): ValidationFeedback {
  const fallback = {
    status: "error" as const,
    title: "Recipe validation failed.",
    details: [error.message],
  };
  try {
    const detail: unknown = JSON.parse(error.message);
    if (!detail || typeof detail !== "object") return fallback;
    const errorDetail = detail as { message?: unknown; errors?: unknown };
    const message = typeof errorDetail.message === "string" ? errorDetail.message : "Recipe validation failed.";
    const errors = Array.isArray(errorDetail.errors) ? errorDetail.errors : [];
    const details = errors
      .map((fieldError: unknown) => {
        if (!fieldError || typeof fieldError !== "object") return null;
        const fieldErrorDetail = fieldError as { path?: unknown; message?: unknown };
        const path = typeof fieldErrorDetail.path === "string" ? fieldErrorDetail.path : "recipe";
        const fieldMessage = typeof fieldErrorDetail.message === "string" ? fieldErrorDetail.message : "Invalid value.";
        return `${path}: ${fieldMessage}`;
      })
      .filter((detail: string | null): detail is string => Boolean(detail));
    return {
      status: "error",
      title: message,
      details: details.length > 0 ? details : [message],
    };
  } catch {
    return fallback;
  }
}

function formatCoordinate(coordinate?: Coordinate): string {
  if (!coordinate) return "x=0, y=0";
  return `x=${coordinate.x}, y=${coordinate.y}`;
}

function coordinateFromPreview(event: React.MouseEvent<HTMLDivElement>): Coordinate {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: clampCoordinatePercent(Math.round(((event.clientX - rect.left) / rect.width) * 100)),
    y: clampCoordinatePercent(Math.round(((event.clientY - rect.top) / rect.height) * 100)),
  };
}

function clampCoordinatePercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function clampPercent(value: number): number {
  return Math.max(8, Math.min(92, value));
}

createRoot(document.getElementById("root")!).render(<App />);
