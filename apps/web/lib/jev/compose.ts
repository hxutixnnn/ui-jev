import {
  experimental_composeSpec,
  type Experimental_CompositionEvaluator,
  type Experimental_CompositionEvent,
  type Experimental_CompositionStep,
  type Spec,
} from "@json-render/core";
import { playgroundCatalog } from "../render/catalog";
import { buildCandidates, buildCandidatesFromSpec, MAX_ELEMENTS } from "./candidates";
import { createDirectEvaluator } from "./direct-evaluator";

export type Evaluate = Experimental_CompositionEvaluator;
export type TraceStep = Experimental_CompositionStep;
export type CompositionEvent =
  | Extract<Experimental_CompositionEvent, { type: "step" }>
  | (Extract<Experimental_CompositionEvent, { type: "complete" }> & {
      estimatedCostUsd: number | null;
    })
  | { type: "error"; message: string };

/** The playground supplies its own content and recipes to the public API. */
export async function* composeUI(
  prompt: string,
  signal: AbortSignal,
  evaluate: Evaluate = createDirectEvaluator(),
  initialSpec?: Spec,
  history = "",
): AsyncGenerator<CompositionEvent> {
  const { candidates: promptCandidates, initialState } = buildCandidates(prompt, history);
  // Follow-ups reference already-built content, so offer it back as recipes
  // alongside prompt-derived candidates. Same-resource entries compete and
  // only one is selected. Spec-derived recipes go first: evaluators favor
  // earlier options, and restoring existing content is the common follow-up.
  const candidates = initialSpec
    ? [...buildCandidatesFromSpec(initialSpec), ...promptCandidates]
    : promptCandidates;
  for await (const event of experimental_composeSpec({
    catalog: playgroundCatalog,
    candidates,
    initialSpec,
    initialState: { ...initialState, ...initialSpec?.state },
    // Share display copy needed to identify an existing element, never field
    // values, raw binding recipes, action params, or renderer state.
    elementDescriptions:
      initialSpec &&
      Object.fromEntries(
        Object.entries(initialSpec.elements).flatMap(([id, element]) => {
          const labels = [
            "title",
            "text",
            "label",
            "name",
            "direction",
          ].flatMap((key) =>
            typeof element.props[key] === "string"
              ? [`${key}: ${JSON.stringify(element.props[key])}`]
              : [],
          );
          // Let the composer use the matching candidate's description for
          // bound content, so edits can distinguish e.g. profile bio and email.
          return labels.length
            ? [[id, [element.type, ...labels].join("; ")]]
            : [];
        }),
      ),
    prompt,
    signal,
    evaluate,
    maxSteps: MAX_ELEMENTS,
    maxElements: MAX_ELEMENTS,
    maxDepth: 4,
    context: {
      platform:
        "Available: layout shells (card, stacks, grids); headings quoted from the request; account/contact fields (name, email, password, message, topic, remember-me, notifications); form submit/save/reset demo actions; request-extracted metrics, charts, tables, ratings, and progress. Actions run on later user interaction. Submission is a validation/toast demo, not an authentication or messaging service.",
    },
    instructions: {
      root: "Use Card for a compact form or profile card. Use vertical Stack for a page with a heading and several sections, including a dashboard containing a metric row followed by charts or tables. Use Grid as root only when the entire page is one uniform grid of peers.",
      next: "Include a Grid or horizontal Stack for a requested side-by-side group. Include only requested content or conventional essentials (login needs email, password, and submit; a profile card displays avatar, name, role, and bio). Use display elements for viewing data and form fields when the user asks to enter or edit data. Prefer a compact tree. Do not include an extra vertical Stack inside a Card unless an explicit subgroup needs it.",
      parent:
        "Never put headings or form fields inside a horizontal button row. Choose the root for a new top-level section.",
    },
  })) {
    if (event.type === "complete") {
      yield {
        ...event,
        estimatedCostUsd:
          event.inputTokens === null ? null : (event.inputTokens * 0.042) / 1e6,
      };
    } else yield event;
  }
}
