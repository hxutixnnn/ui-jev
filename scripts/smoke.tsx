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
