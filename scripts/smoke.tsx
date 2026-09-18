import { catalog } from "../src/catalog";
import { assembleSpec } from "../src/templates";

const verdicts = [
  { action: "render", template: "landing", density: "spacious", sections: ["include_code", "include_testimonials"], confidence: 0.9, reasons: [], probabilities: {} },
  { action: "render", template: "dashboard", density: "compact", sections: ["include_metrics", "include_table"], confidence: 0.88, reasons: [], probabilities: {} },
  { action: "render", template: "pricing", density: "comfortable", sections: ["include_pricing"], confidence: 0.81, reasons: [], probabilities: {} },
  { action: "render", template: "auth_form", density: "comfortable", sections: ["include_form"], confidence: 0.83, reasons: [], probabilities: {} },
  { action: "render", template: "table_list", density: "compact", sections: ["include_table"], confidence: 0.77, reasons: [], probabilities: {} },
  { action: "review", template: "landing", density: "comfortable", sections: [], confidence: 0.3, reasons: ["low conf"], probabilities: {} },
  { action: "refuse", template: "landing", density: "comfortable", sections: [], confidence: 0, reasons: ["spam"], probabilities: {} },
];

let failed = 0;
for (const v of verdicts) {
  // @ts-expect-error smoke shapes
  const spec = assembleSpec(v, "smoke prompt");
  const res = catalog.validate(spec);
  const ok = res.success;
  console.log(`${ok ? "PASS" : "FAIL"} template=${v.template} action=${v.action} elements=${Object.keys(spec.elements).length}`);
  if (!ok) {
    failed++;
    console.log(JSON.stringify(res.error?.issues ?? res).slice(0, 500));
  }
}
const prompt = catalog.prompt();
console.log(`catalog.prompt length=${prompt.length} components=${catalog.componentNames.length}`);
if (failed > 0) process.exit(1);
console.log(`catalog smoke: ${verdicts.length}/${verdicts.length} specs valid`);

// No hardcoded UI: every rendered string must trace to the prompt or verdict.
import { EXAMPLE_PROMPTS } from "../src/templates";
const FORBIDDEN = [
  "Ada Lovelace",
  "Grace Hopper",
  "Alan Turing",
  "24.8k",
  "3.4%",
  "Starter",
  "Shipped in a day",
  "Guardrails held",
  "Beta team",
  "Your numbers, live",
  "Simple plans that scale",
  "Sign in to continue",
  "Everything in one table",
  "Get started",
  "Refresh data",
  "Export report",
  "Talk to sales",
];
const probePrompts = [...EXAMPLE_PROMPTS, "A quiet page with nothing special in it"];
for (const p of probePrompts) {
  for (const v of verdicts) {
    // @ts-expect-error smoke shapes
    const json = JSON.stringify(assembleSpec({ ...v, reasons: [] }, p));
    for (const f of FORBIDDEN) {
      // A string counts as hardcoded only if rendered WITHOUT being in the prompt.
      if (json.includes(f) && !p.includes(f)) {
        console.error(`HARDCODED LEAK: "${f}" rendered for prompt "${p}"`);
        process.exit(1);
      }
    }
  }
}
console.log(`no-hardcode check: ${probePrompts.length * verdicts.length} specs clean`);
