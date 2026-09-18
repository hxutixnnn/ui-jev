import type { Spec } from "@json-render/core";

export type { Spec };

export type Verdict = {
  action: "render" | "review" | "refuse";
  template: string;
  density: string;
  sections: string[];
  confidence: number;
  reasons: string[];
  probabilities: Record<string, number>;
};

type El = {
  type: string;
  props: Record<string, unknown>;
  children: string[];
};

function el(type: string, props: Record<string, unknown> = {}, children: string[] = []): El {
  return { type, props, children };
}

// --- Deterministic extractors: everything rendered comes from the prompt. ---

function sentences(prompt: string): string[] {
  return prompt
    .split(/[.!?\n]+/)
    .map((s) => s.trim().replace(/^["“]+|["”]+$/g, ""))
    .filter(Boolean);
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function short(prompt: string, n = 90): string {
  return prompt.length > n ? `${prompt.slice(0, n)}…` : prompt;
}

const CTA_VERBS = [
  "sign up",
  "sign in",
  "start",
  "try",
  "buy",
  "get",
  "view",
  "add",
  "download",
  "subscribe",
  "join",
  "contact",
  "learn",
  "explore",
  "shop",
  "book",
];

function ctaLabel(prompt: string): string | null {
  for (const v of CTA_VERBS) {
    if (new RegExp(`\\b${v}\\b`, "i").test(prompt)) return cap(v);
  }
  return null;
}

function extractNumbers(prompt: string): { label: string; value: string }[] {
  const re = /\$?\d[\d,]*(?:\.\d+)?\s?(?:%|[kmb](?![a-z])|\/mo)?/gi;
  const out: { label: string; value: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null && out.length < 4) {
    const value = m[0].trim();
    const before = prompt
      .slice(0, m.index)
      .trim()
      .split(/\s+/)
      .slice(-2)
      .join(" ")
      .replace(/[:\-–—,.()]+$/g, "");
    out.push({ label: cap(before) || `Metric ${out.length + 1}`, value });
  }
  return out;
}

function extractListItems(prompt: string): string[] {
  const parts = prompt
    .split(/[,;]|\s+and\s+/i)
    .map((s) => s.trim().replace(/^[^:;]{1,30}:\s*/, ""))
    .filter((s) => s.length > 0);
  return parts.length >= 2 ? parts.slice(0, 8) : [];
}

function extractQuotes(prompt: string): string[] {
  const out: string[] = [];
  const re = /["“]([^"”]+)["”]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null && out.length < 4) out.push(m[1].trim());
  return out;
}

const FORM_HINTS: [RegExp, string, string[]][] = [
  [/\blog(in|ging)?\b|\bsign\s?in\b/i, "Login", ["Email", "Password"]],
  [/\bsign\s?up\b|\bregister\b/i, "Signup", ["Name", "Email", "Password"]],
  [/\bcontact\b/i, "Contact", ["Name", "Email", "Message"]],
  [/\bsearch\b/i, "Search", ["Search"]],
  [/\bsubscribe\b|\bnewsletter\b/i, "Subscribe", ["Email"]],
];

/**
 * Code owns the spec. Jev only picks the template + sections;
 * every string below is extracted from the prompt or the verdict.
 * Sections with no supporting data in the prompt are omitted, never faked.
 */
export function assembleSpec(verdict: Verdict, prompt: string): Spec {
  const elements: Record<string, El> = {};
  elements.nav = el("Nav", { brand: "ui-jev" });

  if (verdict.action === "refuse") {
    return {
      root: "page",
      elements: {
        ...elements,
        page: el("Page", { title: "held" }, ["nav", "alert"]),
        alert: el("Alert", {
          title: "Not rendered",
          message: verdict.reasons[0] ?? "Held by policy",
          tone: "error",
        }),
      },
    } as unknown as Spec;
  }

  const [first, second] = sentences(prompt);
  const kids: string[] = ["nav", "hero"];
  const heroProps: Record<string, unknown> = {
    eyebrow: verdict.template,
    title: first ? cap(short(first, 80)) : verdict.template,
  };
  if (second) heroProps.subtitle = cap(short(second, 140));
  const cta = ctaLabel(prompt);
  if (cta) heroProps.primaryLabel = cta;
  elements.hero = el("Hero", heroProps);

  if (verdict.action === "review") {
    kids.push("flag");
    elements.flag = el("Alert", {
      title: "Low confidence — review suggested",
      message: verdict.reasons[0] ?? "Jev was unsure",
      tone: "warn",
    });
  }

  const wants = (s: string) => verdict.sections.includes(s);
  const numbers = extractNumbers(prompt);
  const amounts = numbers.filter((n) => n.value.includes("$"));

  if (wants("include_metrics") || verdict.template === "dashboard") {
    const metrics = (verdict.template === "dashboard" ? numbers : numbers).slice(0, 3);
    if (metrics.length > 0) {
      const gap = verdict.density === "compact" ? "sm" : verdict.density === "spacious" ? "lg" : "md";
      kids.push("metrics");
      elements.metrics = el("Grid", { columns: metrics.length, gap }, metrics.map((_, i) => `m${i}`));
      metrics.forEach((m, i) => {
        elements[`m${i}`] = el("Metric", { label: m.label, value: m.value });
      });
    }
  }

  if (wants("include_table") || verdict.template === "table_list") {
    const items = extractListItems(prompt);
    if (items.length > 0) {
      kids.push("table");
      elements.table = el("Table", {
        caption: short(prompt),
        columns: ["Items"],
        rows: items.map((item) => [item]),
      });
    }
  }

  if (wants("include_pricing") || verdict.template === "pricing") {
    if (amounts.length > 0) {
      kids.push("tiers");
      elements.tiers = el(
        "Grid",
        { columns: Math.min(amounts.length, 3), gap: "md" },
        amounts.map((_, i) => `t${i}`),
      );
      amounts.forEach((a, i) => {
        elements[`t${i}`] = el("Card", { title: a.label || `Plan ${i + 1}`, description: a.value });
      });
    }
  }

  if (wants("include_form") || verdict.template === "auth_form") {
    const hint = FORM_HINTS.find(([re]) => re.test(prompt));
    kids.push("form");
    if (hint) {
      elements.form = el(
        "Card",
        { title: `${hint[1]} form`, description: hint[2].join(" · ") },
        ["cta"],
      );
    } else {
      elements.form = el("Card", { title: cap(short(first ?? "Form", 60)) }, ["cta"]);
    }
    elements.cta = el("Button", { label: cta ?? "Submit", variant: "primary" });
  }

  if (wants("include_code")) {
    kids.push("code");
    elements.code = el("CodeBlock", {
      title: "Jev plan",
      code: JSON.stringify(
        { template: verdict.template, density: verdict.density, sections: verdict.sections },
        null,
        2,
      ),
    });
  }

  if (wants("include_testimonials")) {
    const quotes = extractQuotes(prompt);
    if (quotes.length > 0) {
      kids.push("proof");
      elements.proof = el(
        "Grid",
        { columns: Math.min(quotes.length, 2), gap: "md" },
        quotes.map((_, i) => `q${i}`),
      );
      quotes.forEach((q, i) => {
        elements[`q${i}`] = el("Card", { title: `“${q}”` });
      });
    }
  }

  elements.page = el("Page", { title: verdict.template }, kids);
  return { root: "page", elements } as unknown as Spec;
}

export const EXAMPLE_PROMPTS = [
  "Startup launch: 24.8k signups, 3.4% conversion. Try the live demo",
  "Pricing: Starter $0, Pro $20/mo, Team $99/mo",
  "Team directory: Ada leads design, Grace owns infra, Alan reviews research",
  "Sign up to get early access",
];
