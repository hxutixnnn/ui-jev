export const THRESHOLDS = {
  spamRefuse: 0.8,
  piiRefuse: 0.5,
  unsafeRefuse: 0.6,
  sectionInclude: 0.5,
  lowConfidence: 0.5,
};

export const SECTIONS = [
  "include_metrics",
  "include_chart",
  "include_table",
  "include_inputs",
  "include_rating",
  "include_progress",
] as const;

export type Section = (typeof SECTIONS)[number];

export type Verdict = {
  action: "render" | "review" | "refuse";
  template: string;
  sections: Section[];
  confidence: number;
  reasons: string[];
  probabilities: Record<string, number>;
};

type Answers = Record<
  string,
  {
    noul?: number;
    choice?: string;
    confidence?: number;
    probabilities?: Record<string, number>;
  }
>;

/**
 * Code owns the policy; Jev supplies judgments.
 */
export function decide(answers: Answers, thresholds = THRESHOLDS): Verdict {
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  const spam = num(answers?.is_spam?.noul);
  const pii = num(answers?.contains_pii?.noul);
  const unsafe = num(answers?.unsafe_request?.noul);
  const template = answers?.template?.choice ?? "no_match";
  const confidence = num(answers?.template?.confidence);

  if (spam > thresholds.spamRefuse) {
    return refuse(`spam=${spam.toFixed(2)} — no real UI intent`);
  }
  if (pii > thresholds.piiRefuse) {
    return refuse(`pii=${pii.toFixed(2)} — personal data must not be echoed`);
  }
  if (unsafe > thresholds.unsafeRefuse) {
    return refuse(`unsafe=${unsafe.toFixed(2)} — deceptive or harmful request`);
  }

  const sections = SECTIONS.filter(
    (s) => num(answers?.[s]?.noul) > thresholds.sectionInclude,
  );

  if (template === "no_match" || confidence < thresholds.lowConfidence) {
    return {
      action: "review",
      template: template === "no_match" ? "landing" : template,
      sections,
      confidence,
      reasons: [
        `template=${template} conf=${confidence.toFixed(2)} — low confidence, review suggested`,
      ],
      probabilities: answers?.template?.probabilities ?? {},
    };
  }

  return {
    action: "render",
    template,
    sections,
    confidence,
    reasons: [
      `template=${template} conf=${confidence.toFixed(2)} sections=[${sections.join(",") || "base"}]`,
    ],
    probabilities: answers?.template?.probabilities ?? {},
  };
}

function refuse(reason: string): Verdict {
  return {
    action: "refuse",
    template: "landing",
    sections: [],
    confidence: 0,
    reasons: [reason],
    probabilities: {},
  };
}
