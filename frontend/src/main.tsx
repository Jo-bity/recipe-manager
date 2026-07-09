import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type Coordinate = {
  x: number;
  y: number;
};

type TakeImageStep = {
  id: string;
  type: "take_image";
  include_pointcloud: boolean;
  image_scope: "full_battery" | "section";
  center?: Coordinate;
};

type UnscrewingStep = {
  id: string;
  type: "unscrewing";
  mode: "automatic" | "specific";
  target?: Coordinate;
};

type RecipeStep = TakeImageStep | UnscrewingStep;

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(JSON.stringify(payload.detail ?? payload, null, 2));
  }
  return response.json() as Promise<T>;
}

function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);
  const [recipeName, setRecipeName] = useState("");
  const [stepType, setStepType] = useState<RecipeStep["type"]>("take_image");
  const [imageScope, setImageScope] = useState<TakeImageStep["image_scope"]>("full_battery");
  const [includePointcloud, setIncludePointcloud] = useState(false);
  const [center, setCenter] = useState<Coordinate>({ x: 0, y: 0 });
  const [unscrewingMode, setUnscrewingMode] = useState<UnscrewingStep["mode"]>("automatic");
  const [target, setTarget] = useState<Coordinate>({ x: 0, y: 0 });
  const [importJson, setImportJson] = useState("");
  const [output, setOutput] = useState("{}");

  const activeRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === activeRecipeId) ?? null,
    [activeRecipeId, recipes],
  );

  async function loadRecipes(selectRecipeId = activeRecipeId) {
    const loaded = await api<Recipe[]>("/recipes");
    setRecipes(loaded);
    if (selectRecipeId && loaded.some((recipe) => recipe.id === selectRecipeId)) {
      setActiveRecipeId(selectRecipeId);
    } else if (!selectRecipeId && loaded.length > 0) {
      setActiveRecipeId(loaded[0].id);
    }
  }

  useEffect(() => {
    loadRecipes().catch((error) => setOutput(error.message));
  }, []);

  async function createRecipe(event: FormEvent) {
    event.preventDefault();
    try {
      const recipe = await api<Recipe>("/recipes", {
        method: "POST",
        body: JSON.stringify({ name: recipeName }),
      });
      setRecipeName("");
      await loadRecipes(recipe.id);
    } catch (error) {
      setOutput((error as Error).message);
    }
  }

  async function addStep(event: FormEvent) {
    event.preventDefault();
    if (!activeRecipe) return;

    const step =
      stepType === "take_image"
        ? {
            type: "take_image",
            include_pointcloud: includePointcloud,
            image_scope: imageScope,
            ...(imageScope === "section" ? { center } : {}),
          }
        : {
            type: "unscrewing",
            mode: unscrewingMode,
            ...(unscrewingMode === "specific" ? { target } : {}),
          };

    try {
      const recipe = await api<Recipe>(`/recipes/${activeRecipe.id}/steps`, {
        method: "POST",
        body: JSON.stringify(step),
      });
      await loadRecipes(recipe.id);
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
      await loadRecipes(recipe.id);
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
      await loadRecipes(recipe.id);
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
        <a href="/docs" target="_blank" rel="noreferrer">
          API docs
        </a>
      </section>

      <section className="layout">
        <aside className="panel">
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
                onClick={() => setActiveRecipeId(recipe.id)}
              >
                <span>{recipe.name}</span>
                <span>{recipe.steps.length} steps</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="panel workspace">
          <div className="workspace-header">
            <div>
              <h2>{activeRecipe?.name ?? "Select a recipe"}</h2>
              <p>{activeRecipe ? `${activeRecipe.steps.length} ordered steps` : "Add steps, validate, export, or preview vendor commands."}</p>
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

          <form className="step-form" onSubmit={addStep}>
            <label>
              Step type
              <select value={stepType} onChange={(event) => setStepType(event.target.value as RecipeStep["type"])}>
                <option value="take_image">Take image</option>
                <option value="unscrewing">Unscrewing</option>
              </select>
            </label>

            {stepType === "take_image" ? (
              <div className="field-grid">
                <label>
                  Image scope
                  <select value={imageScope} onChange={(event) => setImageScope(event.target.value as TakeImageStep["image_scope"])}>
                    <option value="full_battery">Full battery</option>
                    <option value="section">Section</option>
                  </select>
                </label>
                <label className="checkbox">
                  <input
                    checked={includePointcloud}
                    type="checkbox"
                    onChange={(event) => setIncludePointcloud(event.target.checked)}
                  />
                  Include pointcloud
                </label>
                {imageScope === "section" ? (
                  <>
                    <CoordinateInput label="Center X" value={center.x} onChange={(x) => setCenter({ ...center, x })} />
                    <CoordinateInput label="Center Y" value={center.y} onChange={(y) => setCenter({ ...center, y })} />
                  </>
                ) : null}
              </div>
            ) : (
              <div className="field-grid">
                <label>
                  Unscrewing mode
                  <select value={unscrewingMode} onChange={(event) => setUnscrewingMode(event.target.value as UnscrewingStep["mode"])}>
                    <option value="automatic">Automatic</option>
                    <option value="specific">Specific</option>
                  </select>
                </label>
                {unscrewingMode === "specific" ? (
                  <>
                    <CoordinateInput label="Target X" value={target.x} onChange={(x) => setTarget({ ...target, x })} />
                    <CoordinateInput label="Target Y" value={target.y} onChange={(y) => setTarget({ ...target, y })} />
                  </>
                ) : null}
              </div>
            )}

            <button disabled={!activeRecipe} type="submit">
              Add step
            </button>
          </form>

          <div className="steps">
            {activeRecipe ? (
              activeRecipe.steps.map((step, index) => (
                <StepRow
                  key={step.id}
                  index={index}
                  step={step}
                  isFirst={index === 0}
                  isLast={index === activeRecipe.steps.length - 1}
                  onMove={moveStep}
                  onRemove={removeStep}
                />
              ))
            ) : (
              <p>No recipe selected.</p>
            )}
          </div>

          <div className="split">
            <section>
              <h3>Import Recipe JSON</h3>
              <textarea
                rows={8}
                spellCheck={false}
                value={importJson}
                onChange={(event) => setImportJson(event.target.value)}
              />
              <button onClick={importRecipe}>Import</button>
            </section>
            <section>
              <h3>Robot command preview</h3>
              <div className="preview-actions">
                <button disabled={!activeRecipe} onClick={() => previewCommands("company_a")}>
                  Company A
                </button>
                <button disabled={!activeRecipe} onClick={() => previewCommands("company_b")}>
                  Company B
                </button>
              </div>
              <pre>{output}</pre>
            </section>
          </div>
        </section>
      </section>
    </main>
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

function StepRow({
  index,
  step,
  isFirst,
  isLast,
  onMove,
  onRemove,
}: {
  index: number;
  step: RecipeStep;
  isFirst: boolean;
  isLast: boolean;
  onMove: (stepId: string, position: number) => void;
  onRemove: (stepId: string) => void;
}) {
  const detail =
    step.type === "take_image"
      ? `${step.image_scope.replace("_", " ")}${step.include_pointcloud ? ", pointcloud" : ""}`
      : `${step.mode} unscrewing`;

  return (
    <div className="step-row">
      <div className="step-main">
        <strong>
          {index + 1}. {step.type.replace("_", " ")}
        </strong>
        <span>{detail}</span>
      </div>
      <div className="icon-actions">
        <button disabled={isFirst} onClick={() => onMove(step.id, index - 1)}>
          Up
        </button>
        <button disabled={isLast} onClick={() => onMove(step.id, index + 1)}>
          Down
        </button>
        <button onClick={() => onRemove(step.id)}>Remove</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
