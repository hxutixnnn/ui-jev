import assert from "node:assert";
import { playgroundCatalog } from "../apps/web/lib/render/catalog";
import { applySpecPatch } from "../apps/web/lib/spec-patch";
import { assembleElements } from "../apps/web/app/api/generate/assemble";
import { decide } from "../apps/web/app/api/generate/policy";

const V = (over: Record<string, unknown> = {}) => ({
  action: "render",
  template: "landing",
  sections: [],
  confidence: 0.9,
  reasons: [],
  probabilities: {},
  ...over,
});

const cases: [string, string, Record<string, unknown>][] = [
  ["dashboard", "Team performance: $12,400 revenue up 18%, deals 72% closed, retention 91%", { template: "dashboard", sections: ["include_metrics", "include_chart", "include_progress"] }],
  ["form", "Sign up to get early access", { template: "form", sections: ["include_inputs"] }],
  ["landing", "Recipe card: Margherita pizza, 4.8 stars, tomato, mozzarella, basil. Try it tonight", { template: "landing", sections: ["include_rating", "include_table"] }],
  ["list", "Order receipt: 2x Margherita $12, 1x Tiramisu $8, total $20", { template: "list", sections: ["include_table", "include_metrics"] }],
  ["profile", "Team profile: Ada Lovelace, design lead building interfaces", { template: "profile", sections: [] }],
];

for (const [name, prompt, v] of cases) {
  // @ts-expect-error test shapes
  const { root, order, elements } = assembleElements(V(v), prompt);
  assert.equal(root, "page");

  // Simulate the JSONL patch stream the route emits, in order.
  let spec: { root: string; elements: Record<string, unknown> } = { root: "", elements: {} };
  spec = applySpecPatch(spec, { op: "add", path: "/root", value: root });
  for (const key of order) {
    if (key === "page") {
      const { children: _k, ...rest } = elements[key] as Record<string, unknown>;
      spec = applySpecPatch(spec, { op: "add", path: `/elements/${key}`, value: { ...rest, children: [] } });
    } else {
      spec = applySpecPatch(spec, { op: "add", path: `/elements/${key}`, value: elements[key] });
    }
  }
  spec = applySpecPatch(spec, {
    op: "replace",
    path: "/elements/page/children",
    value: (elements.page as { children: string[] }).children,
  });

  const res = playgroundCatalog.validate(spec);
  assert.equal(res.success, true, `${name}: ${JSON.stringify(res.error?.issues ?? res).slice(0, 300)}`);

  // No hardcoded UI: banned strings must not render unless in the prompt.
  const json = JSON.stringify(spec);
  for (const f of ["Weekly Revenue", "12,400", "Team Performance", "Alice", "Admin", "Overview", "Welcome", "Hello, world!", '"label":"Submit"']) {
    assert.ok(!json.includes(f) || prompt.includes(f), `${name}: hardcoded leak "${f}"`);
  }
  console.log(`PASS ${name} elements=${order.length}`);
}

// Policy gates.
const baseAnswers = () => ({
  template: { choice: "dashboard", confidence: 0.9, probabilities: {} },
  include_metrics: { noul: 0.9 },
  include_chart: { noul: 0.1 },
  include_table: { noul: 0.1 },
  include_inputs: { noul: 0.1 },
  include_rating: { noul: 0.1 },
  include_progress: { noul: 0.1 },
  is_spam: { noul: 0.01 },
  contains_pii: { noul: 0.01 },
  unsafe_request: { noul: 0.01 },
});
assert.equal(decide(baseAnswers()).action, "render");
assert.equal(decide({ ...baseAnswers(), is_spam: { noul: 0.95 } }).action, "refuse");
assert.equal(decide({ ...baseAnswers(), contains_pii: { noul: 0.7 } }).action, "refuse");
assert.equal(decide({ ...baseAnswers(), template: { choice: "no_match", confidence: 0.9, probabilities: {} } }).action, "review");
console.log("PASS policy gates 4/4");
