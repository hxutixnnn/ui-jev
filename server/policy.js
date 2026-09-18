export const THRESHOLDS = {
  spamRefuse: 0.8,
  piiRefuse: 0.5,
  unsafeRefuse: 0.6,
  sectionInclude: 0.5,
  lowConfidence: 0.5,
};

const SECTIONS = [
  "include_metrics",
  "include_table",
  "include_pricing",
  "include_form",
  "include_code",
  "include_testimonials",
];

/**
 * Code owns the policy; Jev supplies judgments.
 * Returns a render/review/refuse verdict — the client assembles the spec.
 */
export function decide(answers, thresholds = THRESHOLDS) {
  const num = (v) => (typeof v === "number" ? v : 0);
  const spam = num(answers?.is_spam?.noul);
  const pii = num(answers?.contains_pii?.noul);
  const unsafe = num(answers?.unsafe_request?.noul);
  const template = answers?.template?.choice ?? "no_match";
  const confidence = num(answers?.template?.confidence);
  const density = answers?.density?.choice ?? "comfortable";

  if (spam > thresholds.spamRefuse) {
    return refuse(`spam=${spam.toFixed(2)} — no real UI intent`);
  }
  if (pii > thresholds.piiRefuse) {
    return refuse(`pii=${pii.toFixed(2)} — personal data must not be echoed`);
  }
  if (unsafe > thresholds.unsafeRefuse) {
    return refuse(`unsafe=${unsafe.toFixed(2)} — deceptive or harmful request`);
  }

  const sections = SECTIONS.filter((s) => num(answers?.[s]?.noul) > thresholds.sectionInclude);

  if (template === "no_match" || confidence < thresholds.lowConfidence) {
    return {
      action: "review",
      template: template === "no_match" ? "landing" : template,
      density,
      sections,
      confidence,
      reasons: [`template=${template} conf=${confidence.toFixed(2)} — low confidence, review suggested`],
      probabilities: answers?.template?.probabilities ?? {},
    };
  }

  return {
    action: "render",
    template,
    density,
    sections,
    confidence,
    reasons: [`template=${template} conf=${confidence.toFixed(2)} sections=[${sections.join(",") || "base"}]`],
    probabilities: answers?.template?.probabilities ?? {},
  };
}

function refuse(reason) {
  return {
    action: "refuse",
    template: "landing",
    density: "comfortable",
    sections: [],
    confidence: 0,
    reasons: [reason],
    probabilities: {},
  };
}
