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

/**
 * Code owns the spec. Jev only picks the template + sections;
 * every element below is assembled deterministically in code.
 */
export function assembleSpec(verdict: Verdict, prompt: string): Spec {
  const elements: Record<string, El> = {};
  const short = prompt.length > 90 ? `${prompt.slice(0, 90)}…` : prompt;

  if (verdict.action === "refuse") {
    return {
      root: "page",
      elements: {
        page: el("Page", { title: "Request held" }, ["nav", "alert", "foot"]),
        nav: el("Nav", { brand: "ui-jev" }),
        alert: el("Alert", {
          title: "Not rendered",
          message: verdict.reasons[0] ?? "Held by policy",
          tone: "error",
        }),
        foot: el("Footer", { text: "ui-jev · Jev advises, code decides" }),
      },
    } as unknown as Spec;
  }

  const kids: string[] = ["nav", "hero"];
  elements.nav = el("Nav", { brand: "ui-jev" });
  elements.hero = el("Hero", heroFor(verdict.template, short));

  const gap = verdict.density === "compact" ? "sm" : verdict.density === "spacious" ? "lg" : "md";
  const cols = verdict.density === "compact" ? 4 : 3;

  if (verdict.sections.includes("include_metrics") || verdict.template === "dashboard") {
    kids.push("metrics");
    elements.metrics = el("Grid", { columns: cols, gap }, ["m1", "m2", "m3"]);
    elements.m1 = el("Metric", { label: "Active users", value: "24.8k", change: "+12%" });
    elements.m2 = el("Metric", { label: "Conversion", value: "3.4%", change: "+0.6pt" });
    elements.m3 = el("Metric", { label: "Churn", value: "1.1%", change: "-0.2pt" });
  }
  if (verdict.sections.includes("include_table") || verdict.template === "table_list") {
    kids.push("table");
    elements.table = el("Table", {
      caption: "Latest records",
      columns: ["Name", "Plan", "Status"],
      rows: [
        ["Ada Lovelace", "Pro", "Active"],
        ["Grace Hopper", "Team", "Trial"],
        ["Alan Turing", "Free", "Churned"],
      ],
    });
  }
  if (verdict.sections.includes("include_pricing") || verdict.template === "pricing") {
    kids.push("tiers");
    elements.tiers = el("Grid", { columns: 3, gap }, ["t1", "t2", "t3"]);
    elements.t1 = el("Card", { title: "Starter", description: "$0 — for side projects" });
    elements.t2 = el("Card", { title: "Pro", description: "$20/mo — for serious builders" });
    elements.t3 = el("Card", { title: "Team", description: "$99/mo — for companies" });
  }
  if (verdict.sections.includes("include_form") || verdict.template === "auth_form") {
    kids.push("form");
    elements.form = el("Card", { title: "Get started", description: "One input, one button — wired to catalog actions later." }, [
      "cta",
    ]);
    elements.cta = el("Button", { label: "Continue", variant: "primary" });
  }
  if (verdict.sections.includes("include_code")) {
    kids.push("code");
    elements.code = el("CodeBlock", {
      title: "Generated spec (excerpt)",
      code: `{\n  "root": "page",\n  "template": "${verdict.template}"\n}`,
    });
  }
  if (verdict.sections.includes("include_testimonials")) {
    kids.push("proof");
    elements.proof = el("Grid", { columns: 2, gap }, ["q1", "q2"]);
    elements.q1 = el("Card", { title: "“Shipped in a day”", description: "— Beta team" });
    elements.q2 = el("Card", { title: "“Guardrails held”", description: "— Platform team" });
  }
  if (verdict.action === "review") {
    kids.splice(2, 0, "flag");
    elements.flag = el("Alert", {
      title: "Low confidence — review suggested",
      message: verdict.reasons[0] ?? "Jev was unsure",
      tone: "warn",
    });
  }

  kids.push("foot");
  elements.foot = el("Footer", { text: "ui-jev · Jev advises, code decides" });
  elements.page = el("Page", { title: verdict.template }, kids);

  return { root: "page", elements } as unknown as Spec;
}

function heroFor(template: string, short: string): Record<string, unknown> {
  switch (template) {
    case "dashboard":
      return {
        eyebrow: "Dashboard",
        title: "Your numbers, live",
        subtitle: `Planned from: “${short}”`,
        primaryLabel: "Refresh data",
        secondaryLabel: "Export report",
      };
    case "pricing":
      return {
        eyebrow: "Pricing",
        title: "Simple plans that scale",
        subtitle: `Planned from: “${short}”`,
        primaryLabel: "Start free",
        secondaryLabel: "Talk to sales",
      };
    case "auth_form":
      return {
        eyebrow: "Welcome back",
        title: "Sign in to continue",
        subtitle: `Planned from: “${short}”`,
        primaryLabel: "Continue",
      };
    case "table_list":
      return {
        eyebrow: "Records",
        title: "Everything in one table",
        subtitle: `Planned from: “${short}”`,
        primaryLabel: "Add record",
        secondaryLabel: "Filter",
      };
    default:
      return {
        eyebrow: "The Generative UI framework",
        title: "AI → json-render → UI",
        subtitle:
          "Generate dynamic, personalized UIs from prompts without sacrificing reliability. Jev plans within guardrails; code renders.",
        primaryLabel: "Get Started",
        secondaryLabel: "GitHub",
      };
  }
}

export const EXAMPLE_PROMPTS = [
  "A landing page for a developer tool with hero and code sample",
  "A metrics dashboard with KPIs and a data table",
  "Pricing tiers with FAQ-style social proof",
  "A login form to get started",
];
