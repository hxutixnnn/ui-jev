import assert from "node:assert";
import { decide } from "../server/policy.js";

const base = {
  template: { choice: "dashboard", confidence: 0.9, probabilities: { dashboard: 0.9 } },
  density: { choice: "comfortable" },
  include_metrics: { noul: 0.9 },
  include_table: { noul: 0.8 },
  include_pricing: { noul: 0.1 },
  include_form: { noul: 0.1 },
  include_code: { noul: 0.1 },
  include_testimonials: { noul: 0.1 },
  is_spam: { noul: 0.01 },
  contains_pii: { noul: 0.01 },
  unsafe_request: { noul: 0.01 },
};

// render path
const r = decide(structuredClone(base));
assert.equal(r.action, "render");
assert.equal(r.template, "dashboard");
assert.deepEqual(r.sections, ["include_metrics", "include_table"]);

// low confidence -> review
const rev = decide({ ...structuredClone(base), template: { choice: "pricing", confidence: 0.2, probabilities: {} } });
assert.equal(rev.action, "review");

// spam -> refuse
const spam = decide({ ...structuredClone(base), is_spam: { noul: 0.95 } });
assert.equal(spam.action, "refuse");

// PII -> refuse
const pii = decide({ ...structuredClone(base), contains_pii: { noul: 0.7 } });
assert.equal(pii.action, "refuse");

// unsafe -> refuse
const unsafe = decide({ ...structuredClone(base), unsafe_request: { noul: 0.8 } });
assert.equal(unsafe.action, "refuse");

// no_match -> review with landing fallback
const nm = decide({ ...structuredClone(base), template: { choice: "no_match", confidence: 0.9, probabilities: {} } });
assert.equal(nm.action, "review");
assert.equal(nm.template, "landing");

console.log("policy tests: 6/6 passed");
