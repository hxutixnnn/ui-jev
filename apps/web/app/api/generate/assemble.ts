import type { Verdict } from "./policy";

type El = {
  type: string;
  props: Record<string, unknown>;
  children: string[];
  on?: Record<string, unknown>;
};

function el(
  type: string,
  props: Record<string, unknown> = {},
  children: string[] = [],
  on?: Record<string, unknown>,
): El {
  const out: El = { type, props, children };
  if (on) out.on = on;
  return out;
}

// --- Deterministic extractors: every rendered string traces to the prompt. ---

function sentences(prompt: string): string[] {
  return prompt
    .split(/(?:[.!?]+(?=\s+[A-Z]|$))|[\n]+/)
    .map((s) => s.trim().replace(/^["“]+|["”.,;]+$/g, ""))
    .filter(Boolean);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function short(prompt: string, n = 90): string {
  return prompt.length > n ? `${prompt.slice(0, n)}…` : prompt;
}

function cleanLabel(words: string): string {
  return cap(
    words
      .replace(/\$?\d[\d,]*(?:\.\d+)?\s?(?:%|[kmb]\b|\/mo)?/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[:\-–—,.()]+/g, "")
      .replace(/[:\-–—,.()]+$/g, "")
      .trim(),
  );
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

function extractNumbers(
  prompt: string,
  skip: [number, number][] = [],
): { label: string; value: string; amount: number }[] {
  const re = /\$?\d[\d,]*(?:\.\d+)?\s?(?:%|[kmb](?![a-z])|\/mo)?/gi;
  const out: { label: string; value: string; amount: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null && out.length < 6) {
    const start = m.index;
    const end = start + m[0].length;
    if (skip.some(([s, e]) => start < e && end > s)) continue;
    const raw = m[0].trim();
    const amount = parseAmount(raw);
    if (!Number.isFinite(amount)) continue;
    const before = prompt
      .slice(0, start)
      .trim()
      .split(/\s+/)
      .slice(-2)
      .join(" ");
    out.push({ label: cleanLabel(before) || `Metric ${out.length + 1}`, value: raw, amount });
  }
  return out;
}

function parseAmount(raw: string): number {
  let s = raw.replace(/[$,\s]/g, "");
  let mult = 1;
  const suffix = s.match(/([kmb])$/i);
  if (suffix) {
    const key = (suffix[1] ?? "").toLowerCase();
    mult = key === "k" ? 1e3 : key === "m" ? 1e6 : key === "b" ? 1e9 : 1;
    s = s.slice(0, -1);
  }
  s = s.replace(/%|\/mo$/i, "");
  return parseFloat(s) * mult;
}

function extractRating(prompt: string): {
  label: string;
  value: number;
  span: [number, number];
} | null {
  const re = /(\d(?:\.\d+)?)\s?(?:stars?|★)|(?:rating|rated)\s?(\d(?:\.\d+)?)/i;
  const m = re.exec(prompt);
  if (!m) return null;
  const before = prompt
    .slice(0, m.index)
    .trim()
    .split(/\s+/)
    .slice(-2)
    .join(" ");
  return {
    label: cleanLabel(before) || "Rating",
    value: parseFloat(m[1] ?? m[2] ?? "0"),
    span: [m.index, m.index + m[0].length],
  };
}

const PROGRESS_WORDS =
  /complet|done|clos|progress|retention|goal|shipped|capacit|deals|retained/i;

function extractProgress(prompt: string): {
  label: string;
  value: number;
  span: [number, number];
}[] {
  const re = /(\d{1,3})\s?%/g;
  const out: { label: string; value: number; span: [number, number] }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null && out.length < 3) {
    const context = `${prompt.slice(Math.max(0, m.index - 24), m.index)} ${prompt.slice(m.index + m[0].length, m.index + m[0].length + 16)}`;
    if (!PROGRESS_WORDS.test(context)) continue;
    const label = prompt
      .slice(Math.max(0, m.index - 24), m.index)
      .trim()
      .split(/\s+/)
      .slice(-2)
      .join(" ");
    out.push({
      label: cleanLabel(label) || "Progress",
      value: Math.min(100, parseInt(m[1] ?? "0", 10)),
      span: [m.index, m.index + m[0].length],
    });
  }
  return out;
}

function extractListItems(prompt: string): string[] {
  const first = sentences(prompt)[0] ?? prompt;
  const parts = first
    .split(/[,;]|\s+and\s+/i)
    .map((s) => s.trim().replace(/^[^:;]{1,30}:\s*/, ""))
    .filter((s) => s.length > 0);
  return parts.length >= 2 ? parts.slice(0, 8) : [];
}

function extractQuotes(prompt: string): string[] {
  const out: string[] = [];
  const re = /["“]([^"”]+)["”]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null && out.length < 4) {
    const q = m[1]?.trim();
    if (q) out.push(q);
  }
  return out;
}

function extractName(prompt: string): string | null {
  const m = /([A-Z][a-z]+ [A-Z][a-z]+)/.exec(prompt);
  return m?.[1] ?? null;
}

const FORM_HINTS: { re: RegExp; title: string; fields: { label: string; name: string; type: string }[] }[] = [
  {
    re: /\blog(in|ging)?\b|\bsign\s?in\b/i,
    title: "Login",
    fields: [
      { label: "Email", name: "email", type: "email" },
      { label: "Password", name: "password", type: "password" },
    ],
  },
  {
    re: /\bsign\s?up\b|\bregister\b/i,
    title: "Signup",
    fields: [
      { label: "Name", name: "name", type: "text" },
      { label: "Email", name: "email", type: "email" },
      { label: "Password", name: "password", type: "password" },
    ],
  },
  {
    re: /\bcontact\b/i,
    title: "Contact",
    fields: [
      { label: "Name", name: "name", type: "text" },
      { label: "Email", name: "email", type: "email" },
      { label: "Message", name: "message", type: "text" },
    ],
  },
  {
    re: /\bsubscribe\b|\bnewsletter\b/i,
    title: "Subscribe",
    fields: [{ label: "Email", name: "email", type: "email" }],
  },
];

function inputChecks(type: string): { type: string; message: string; args?: Record<string, unknown> }[] {
  const checks: { type: string; message: string; args?: Record<string, unknown> }[] = [
    { type: "required", message: "This field is required" },
  ];
  if (type === "email") checks.push({ type: "email", message: "Enter a valid email" });
  if (type === "password")
    checks.push({ type: "minLength", message: "At least 8 characters", args: { min: 8 } });
  return checks;
}

/**
 * Code owns the spec. Jev picks the template + sections; every string here
 * is extracted from the prompt or the verdict. Sections with no supporting
 * data in the prompt are omitted, never faked.
 *
 * Returns elements in emission order (parents before children) so the
 * JSONL patch stream renders progressively.
 */
export function assembleElements(
  verdict: Verdict,
  prompt: string,
): { root: string; order: string[]; elements: Record<string, El> } {
  const elements: Record<string, El> = {};
  const order: string[] = [];
  const put = (key: string, node: El) => {
    elements[key] = node;
    order.push(key);
  };

  const [first, second] = sentences(prompt);
  const title = first ? cap(short(first, 80)) : verdict.template;
  const wants = (s: string) => verdict.sections.includes(s as never);

  const rating = extractRating(prompt);
  const progress = extractProgress(prompt);
  const consumed: [number, number][] = [
    ...(rating ? [rating.span] : []),
    ...progress.map((p) => p.span),
  ];
  const numbers = extractNumbers(prompt, consumed);

  const showInputs = wants("include_inputs") || verdict.template === "form";
  const showTable = wants("include_table") || verdict.template === "list";
  const showMetrics =
    wants("include_metrics") ||
    verdict.template === "dashboard" ||
    verdict.template === "list";
  const showChart = wants("include_chart") && numbers.length >= 2;
  const showHighlights =
    rating !== null || progress.length > 0
      ? wants("include_rating") ||
        wants("include_progress") ||
        verdict.template === "dashboard"
      : false;

  const kids: string[] = [];

  if (verdict.template === "form") {
    put("page", el("Card", { title, description: second ? cap(short(second, 140)) : null, maxWidth: "sm", centered: true }, []));
  } else {
    put("page", el("Stack", { direction: "vertical", gap: "md" }, []));
  }

  if (verdict.action === "review") {
    kids.push("flag");
    put(
      "flag",
      el("Alert", {
        title: "Low confidence — review suggested",
        message: verdict.reasons[0] ?? "Jev was unsure",
        type: "warning",
      }),
    );
  }

  if (verdict.template === "profile") {
    const name = extractName(prompt);
    if (name) {
      kids.push("avatar", "who", "bio");
      put("avatar", el("Avatar", { name, size: "lg" }));
      put("who", el("Heading", { text: name, level: "h1" }));
      const rest = short(prompt.replace(name, "").replace(/^[:,\-\s]+/, ""), 140);
      if (rest) put("bio", el("Text", { text: cap(rest), variant: "lead" }));
      else kids.pop();
    }
  }

  if (verdict.template !== "profile" || !extractName(prompt)) {
    kids.push("hero-title");
    put("hero-title", el("Heading", { text: title, level: "h1" }));
    if (second) {
      kids.push("hero-sub");
      put("hero-sub", el("Text", { text: cap(short(second, 140)), variant: "lead" }));
    }
    const cta = ctaLabel(prompt);
    if (cta) {
      kids.push("cta-row", "cta");
      put("cta-row", el("Stack", { direction: "horizontal", gap: "sm" }, ["cta"]));
      put(
        "cta",
        el("Button", { label: cta, variant: "primary" }, [], {
          press: [{ action: "buttonClick", params: { message: cta } }],
        }),
      );
    }
  }

  if (showHighlights) {
    const cols: string[] = [];
    if (rating && (wants("include_rating") || verdict.template === "dashboard")) {
      cols.push("rate");
      put("rate", el("Rating", { label: rating.label, value: rating.value, max: 5, interactive: false }));
    }
    if (wants("include_progress") || verdict.template === "dashboard") {
      progress.forEach((p, i) => {
        cols.push(`prog${i}`);
        put(`prog${i}`, el("Progress", { label: p.label, value: p.value, max: 100 }));
      });
    }
    if (cols.length > 0) {
      kids.push("highlights");
      put("highlights", el("Grid", { columns: Math.min(cols.length, 2), gap: "md" }, cols));
    }
  }

  if (showMetrics) {
    const metrics = numbers.slice(0, 3);
    if (metrics.length > 0) {
      const mkeys = metrics.map((_, i) => `m${i}`);
      kids.push("metrics");
      put("metrics", el("Grid", { columns: mkeys.length, gap: "md" }, mkeys));
      metrics.forEach((m, i) => {
        const props: Record<string, unknown> = { label: m.label, value: m.value };
        if (m.value.startsWith("$")) {
          props.value = m.value.slice(1);
          props.prefix = "$";
        }
        const tail = prompt.slice(prompt.indexOf(m.value) + m.value.length, prompt.indexOf(m.value) + m.value.length + 14);
        const ch = /(up|\+)\s?(\d+%?)|(down|-)\s?(\d+%?)/i.exec(tail);
        if (ch) {
          const up = Boolean(ch[1]);
          props.change = `${up ? "+" : "-"}${ch[2] ?? ch[4] ?? ""}`;
          props.changeType = up ? "positive" : "negative";
        }
        put(`m${i}`, el("Metric", props));
      });
    }
  }

  if (showChart) {
    const data = numbers.slice(0, 7).map((n, i) => ({
      label: n.label && !/^metric \d+$/i.test(n.label) ? n.label : `Item ${i + 1}`,
      value: n.amount,
    }));
    kids.push("chart");
    put("chart", el("BarGraph", { title: null, data }));
  }

  if (showTable) {
    const items = extractListItems(prompt);
    if (items.length > 0) {
      kids.push("table");
      put("table", el("Table", {
        caption: short(prompt),
        columns: ["Items"],
        rows: items.map((item) => [item]),
      }));
    }
  }

  if (showInputs) {
    const hint = FORM_HINTS.find((h) => h.re.test(prompt));
    const fields = hint?.fields ?? [{ label: "Name", name: "name", type: "text" }];
    const fkeys = fields.map((f) => `in-${f.name}`);
    kids.push("form-card");
    put(
      "form-card",
      el("Card", { title: hint ? hint.title : title, description: null, maxWidth: "sm", centered: true }, [...fkeys, "submit"]),
    );
    fields.forEach((f) => {
      put(
        `in-${f.name}`,
        el("Input", {
          label: f.label,
          name: f.name,
          type: f.type,
          placeholder: null,
          value: { $bindState: `/form/${f.name}` },
          checks: inputChecks(f.type),
        }),
      );
    });
    put(
      "submit",
      el("Button", { label: ctaLabel(prompt) ?? "Submit", variant: "primary" }, [], {
        press: [{ action: "formSubmit", params: { formName: hint?.title ?? null } }],
      }),
    );
  }

  const quotes = extractQuotes(prompt);
  if (quotes.length > 0 && verdict.template === "landing") {
    const qkeys = quotes.map((_, i) => `q${i}`);
    kids.push("quotes");
    put("quotes", el("Grid", { columns: Math.min(qkeys.length, 2), gap: "md" }, qkeys));
    quotes.forEach((q, i) => {
      put(`q${i}`, el("Card", { title: null, description: q }));
    });
  }

  const page = elements.page;
  if (page) page.children = kids;
  return { root: "page", order, elements };
}
