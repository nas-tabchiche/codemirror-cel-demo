<script lang="ts">
  import CelEditor from "./lib/CelEditor.svelte";
  import type { CelLanguageConfig } from "./lib/cel/cel-language";
  import { evaluate } from "cel-js";

  // Autocomplete entries for the CISO Assistant CEL context.
  const celConfig: CelLanguageConfig = {
    completions: [
      { label: "assessment", type: "variable", detail: "map", info: "Assessment-level aggregates" },
      { label: "assessment.score_sum", type: "property", detail: "int", info: "Sum of all requirement scores" },
      { label: "assessment.score_max", type: "property", detail: "int", info: "Maximum possible score" },
      { label: "assessment.answered_count", type: "property", detail: "int", info: "Number of answered requirements" },
      { label: "assessment.total_count", type: "property", detail: "int", info: "Total assessable requirements" },
      { label: "requirements", type: "variable", detail: "map<string, map>", info: "Keyed by URN — .score, .max_score, .result, .status" },
      { label: "ref_ids", type: "variable", detail: "map<string, map>", info: "Keyed by ref_id — .score, .max_score, .result, .status" },
      { label: "answers", type: "variable", detail: "map<string, map>", info: "Keyed by question URN — .score, .value, .selected_choices, .weight, .type" },
      { label: "computed_outcomes", type: "variable", detail: "map<string, map>", info: "Previously computed outcome ref_ids" },
      { label: "hidden_requirements", type: "variable", detail: "list<string>", info: "URNs of hidden requirements" },
    ],
  };

  // Sample execution context — mirrors what cel_service.py builds from a real assessment.
  // Users can edit this JSON to test different scenarios.
  const defaultContext = {
    assessment: {
      score_sum: 160,
      score_max: 300,
      answered_count: 2,
      total_count: 3,
    },
    requirements: {
      "urn:intuitem:risk:req_node:my-framework:1.1": {
        score: 80,
        max_score: 100,
        result: "compliant",
        status: "done",
      },
      "urn:intuitem:risk:req_node:my-framework:1.2": {
        score: 80,
        max_score: 100,
        result: "compliant",
        status: "done",
      },
      "urn:intuitem:risk:req_node:my-framework:2.1": {
        score: 0,
        max_score: 100,
        result: "not_assessed",
        status: "to_do",
      },
    },
    ref_ids: {
      "REQ-1.1": {
        score: 80,
        max_score: 100,
        result: "compliant",
        status: "done",
      },
      "REQ-1.2": {
        score: 80,
        max_score: 100,
        result: "compliant",
        status: "done",
      },
      "REQ-2.1": {
        score: 0,
        max_score: 100,
        result: "not_assessed",
        status: "to_do",
      },
    },
    answers: {
      Q1: {
        value: "yes",
        score: 80,
        selected_choices: ["urn:choice:yes"],
        weight: 1,
        type: "unique_choice",
      },
      Q2: {
        value: "",
        score: 3,
        selected_choices: ["urn:choice:medium"],
        weight: 1,
        type: "unique_choice",
      },
    },
    computed_outcomes: {},
    hidden_requirements: [] as string[],
  };

  const examples = [
    {
      title: "Outcome rule — score threshold",
      doc: "assessment.score_sum >= 150",
      description: "Award an outcome when the total score reaches a threshold",
    },
    {
      title: "Outcome rule — percentage-based",
      doc: "assessment.score_sum / assessment.score_max >= 0.8",
      description: "Award outcome when 80%+ of max possible score is achieved",
    },
    {
      title: "Outcome rule — catch-all",
      doc: "true",
      description: "Always matches — use as the last rule in an ordered list",
    },
    {
      title: "Visibility — requirement score condition",
      doc: 'requirements["urn:intuitem:risk:req_node:my-framework:1.1"].score > 50',
      description:
        "Show requirement only when another requirement scores above 50",
    },
    {
      title: "Visibility — answer-based branching",
      doc: 'answers["Q1"].value == "yes" && answers["Q2"].score >= 3',
      description: "Conditional visibility based on questionnaire answers",
    },
    {
      title: "Complex — multi-condition outcome",
      doc: 'assessment.answered_count == assessment.total_count\n  && assessment.score_sum / assessment.score_max >= 0.6\n  && !("urn:critical-req" in hidden_requirements)',
      description:
        "All questions answered, 60%+ score, and critical requirement visible",
    },
  ];

  let selectedIdx = $state(0);
  let currentValue = $state(examples[0].doc);
  let contextJson = $state(JSON.stringify(defaultContext, null, 2));
  let contextError = $state("");
  let evalResult = $state<{ value: unknown; error: string | null }>({
    value: null,
    error: null,
  });

  function selectExample(idx: number) {
    selectedIdx = idx;
    currentValue = examples[idx].doc;
  }

  function runEvaluation() {
    try {
      const ctx = JSON.parse(contextJson);
      contextError = "";
      try {
        const result = evaluate(currentValue, ctx);
        evalResult = { value: result, error: null };
      } catch (e) {
        evalResult = {
          value: null,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    } catch (e) {
      contextError =
        "Invalid JSON: " + (e instanceof Error ? e.message : String(e));
      evalResult = { value: null, error: null };
    }
  }

  // Auto-evaluate on expression or context changes
  $effect(() => {
    currentValue;
    contextJson;
    runEvaluation();
  });
</script>

<div class="app">
  <header>
    <h1>CEL Editor for CISO Assistant</h1>
    <p class="subtitle">
      CodeMirror 6 + custom Lezer grammar — syntax highlighting, bracket matching,
      and autocomplete for CEL expressions
    </p>
  </header>

  <div class="layout">
    <aside class="sidebar">
      <div class="examples-panel">
        <h2>Examples</h2>
        {#each examples as example, i}
          <button
            class="example-card"
            class:selected={selectedIdx === i}
            onclick={() => selectExample(i)}
          >
            <strong>{example.title}</strong>
            <span class="example-desc">{example.description}</span>
          </button>
        {/each}
      </div>
    </aside>

    <main class="editor-panel">
      <div class="editor-header">
        <h2>{examples[selectedIdx].title}</h2>
        <p>{examples[selectedIdx].description}</p>
      </div>

      {#key selectedIdx}
        <CelEditor
          doc={examples[selectedIdx].doc}
          celConfig={celConfig}
          theme="dark"
          onchange={(v) => (currentValue = v)}
        />
      {/key}

      <div
        class="eval-result"
        class:eval-true={evalResult.value === true}
        class:eval-false={evalResult.value === false}
        class:eval-error={evalResult.error !== null}
      >
        <div class="eval-label">Evaluation result</div>
        <div class="eval-value">
          {#if evalResult.error}
            <span class="error-icon">&#x2717;</span> {evalResult.error}
          {:else if evalResult.value === true}
            <span class="true-icon">&#x2713;</span> true
          {:else if evalResult.value === false}
            <span class="false-icon">&#x2717;</span> false
          {:else}
            {JSON.stringify(evalResult.value)}
          {/if}
        </div>
      </div>

      <div class="context-section">
        <div class="context-header">
          <h3>Execution context</h3>
          <span class="context-hint"
            >Edit the JSON below to test different scenarios</span
          >
          {#if contextError}
            <span class="json-error">{contextError}</span>
          {/if}
        </div>
        <textarea
          class="context-editor"
          bind:value={contextJson}
          spellcheck="false"
          rows="24"
        ></textarea>
      </div>
    </main>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      sans-serif;
    background: #0f172a;
    color: #e2e8f0;
  }

  .app {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
  }

  header {
    margin-bottom: 32px;
  }

  h1 {
    margin: 0 0 8px;
    font-size: 28px;
    color: #f1f5f9;
  }

  .subtitle {
    margin: 0;
    color: #94a3b8;
    font-size: 15px;
  }

  .layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 24px;
  }

  .sidebar {
    position: sticky;
    top: 24px;
    align-self: start;
  }

  .examples-panel h2,
  .editor-panel h2 {
    margin: 0 0 12px;
    font-size: 16px;
    color: #cbd5e1;
  }

  .example-card {
    display: block;
    width: 100%;
    text-align: left;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: border-color 0.15s;
    color: #e2e8f0;
  }

  .example-card:hover {
    border-color: #60a5fa;
  }

  .example-card.selected {
    border-color: #3b82f6;
    background: #1e3a5f;
  }

  .example-card strong {
    display: block;
    font-size: 13px;
    margin-bottom: 4px;
  }

  .example-desc {
    display: block;
    font-size: 12px;
    color: #94a3b8;
  }

  .editor-header {
    margin-bottom: 12px;
  }

  .editor-header p {
    margin: 4px 0 0;
    font-size: 13px;
    color: #94a3b8;
  }

  /* Evaluation result */
  .eval-result {
    margin-top: 16px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid #334155;
    background: #1e293b;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .eval-result.eval-true {
    border-color: #22c55e;
    background: #052e16;
  }

  .eval-result.eval-false {
    border-color: #f59e0b;
    background: #451a03;
  }

  .eval-result.eval-error {
    border-color: #ef4444;
    background: #450a0a;
  }

  .eval-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    white-space: nowrap;
  }

  .eval-value {
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 15px;
    font-weight: 600;
  }

  .true-icon {
    color: #4ade80;
  }

  .false-icon {
    color: #fbbf24;
  }

  .error-icon {
    color: #f87171;
  }

  /* Context editor */
  .context-section {
    margin-top: 24px;
  }

  .context-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .context-header h3 {
    margin: 0;
    font-size: 14px;
    color: #cbd5e1;
  }

  .context-hint {
    font-size: 12px;
    color: #64748b;
  }

  .json-error {
    font-size: 12px;
    color: #f87171;
    font-family: monospace;
  }

  .context-editor {
    width: 100%;
    box-sizing: border-box;
    background: #0f172a;
    color: #a5f3fc;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 12px 16px;
    font-family: "JetBrains Mono", "Fira Code", monospace;
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
    outline: none;
    tab-size: 2;
  }

  .context-editor:focus {
    border-color: #3b82f6;
  }

  @media (max-width: 768px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: static;
    }
  }
</style>
