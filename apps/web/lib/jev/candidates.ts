import type {
  Experimental_CompositionCandidate,
  UIElement,
} from "@json-render/core";

export const MAX_ELEMENTS = 14;
export type Candidate = Experimental_CompositionCandidate;

// --- Prompt extractors: every content string traces to the request. ---

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

type Num = { label: string; value: string; amount: number; span: [number, number] };

function extractNumbers(prompt: string, skip: [number, number][] = []): Num[] {
  const re = /\$?\d[\d,]*(?:\.\d+)?\s?(?:%|[kmb](?![a-z])|\/mo)?/gi;
  const out: Num[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null && out.length < 6) {
    const start = m.index;
    const end = start + m[0].length;
    if (skip.some(([s, e]) => start < e && end > s)) continue;
    const amount = parseAmount(m[0].trim());
    if (!Number.isFinite(amount)) continue;
    const before = prompt.slice(0, start).trim().split(/\s+/).slice(-2).join(" ");
    out.push({
      label: cleanLabel(before) || `Metric ${out.length + 1}`,
      value: m[0].trim(),
      amount,
      span: [start, end],
    });
  }
  return out;
}

function extractRating(prompt: string) {
  const re = /(\d(?:\.\d+)?)\s?(?:stars?|★)|(?:rating|rated)\s?(\d(?:\.\d+)?)/i;
  const m = re.exec(prompt);
  if (!m) return null;
  const before = prompt.slice(0, m.index).trim().split(/\s+/).slice(-2).join(" ");
  return {
    label: cleanLabel(before) || "Rating",
    value: parseFloat(m[1] ?? m[2] ?? "0"),
    span: [m.index, m.index + m[0].length] as [number, number],
  };
}

const PROGRESS_WORDS =
  /complet|done|clos|progress|retention|goal|shipped|capacit|deals|retained/i;

function extractProgress(prompt: string) {
  const re = /(\d{1,3})\s?%/g;
  const out: { label: string; value: number; span: [number, number] }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null && out.length < 3) {
    const context = `${prompt.slice(Math.max(0, m.index - 24), m.index)} ${prompt.slice(m.index + m[0].length, m.index + m[0].length + 16)}`;
    if (!PROGRESS_WORDS.test(context)) continue;
    const label = prompt.slice(Math.max(0, m.index - 24), m.index).trim().split(/\s+/).slice(-2).join(" ");
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

function extractName(prompt: string): string | null {
  const m = /([A-Z][a-z]+ [A-Z][a-z]+)/.exec(prompt);
  return m?.[1] ?? null;
}

const CTA_VERBS = [
  "sign up", "sign in", "start", "try", "buy", "get", "view", "add",
  "download", "subscribe", "join", "contact", "learn", "explore", "shop", "book",
];

function ctaLabel(prompt: string): string | null {
  for (const v of CTA_VERBS) {
    if (new RegExp(`\\b${v}\\b`, "i").test(prompt)) return cap(v);
  }
  return null;
}

export const initialFormState = {
  name: "",
  email: "",
  password: "",
  message: "",
  topic: "General",
  notifications: false,
  remember: false,
};

/**
 * Prompt-derived atomic candidates. Layout shells, field recipes, and action
 * bindings are platform-owned structure; every content string (titles,
 * metrics, rows, ratings, names) is extracted from the request. Sections
 * with no supporting data are omitted, never faked.
 */
export function buildCandidates(
  prompt: string,
  history = "",
): {
  candidates: Candidate[];
  initialState: Record<string, unknown>;
} {
  const candidates: Candidate[] = [];
  function add(
    id: string,
    description: string,
    type: string,
    props: Record<string, unknown>,
    resource?: string,
    on?: UIElement["on"],
  ) {
    candidates.push({
      id,
      description,
      resource,
      root: ["card", "stack_vertical", "grid_two", "grid_three"].includes(id),
      maxUses: ["Card", "Stack", "Grid", "Separator"].includes(type) ? MAX_ELEMENTS : 1,
      element: { type, props, ...(on ? { on } : {}) },
    });
  }

  // Layout shells (structure only).
  add("card", "Card: a bordered container for a compact form or related content.",
    "Card", { title: null, description: null, maxWidth: "md", centered: true });
  add("stack_vertical", "Stack: vertical layout for a page or section.",
    "Stack", { direction: "vertical", gap: "md", align: "stretch", justify: "start" });
  add("stack_horizontal",
    "Stack: horizontal row for two or more explicitly requested side-by-side elements, such as Save and Reset buttons. Not needed for a single button or an ordinary vertical form.",
    "Stack", { direction: "horizontal", gap: "sm", align: "center", justify: "start" });
  add("grid_two", "Grid: two equal columns for side-by-side content.",
    "Grid", { columns: 2, gap: "md" });
  add("grid_three", "Grid: three equal columns, e.g. a row of metrics.",
    "Grid", { columns: 3, gap: "md" });

  // Headings: quoted titles copied from the request only.
  const quoted = [...prompt.matchAll(/["“]([^"”\n]{1,80})["”]/g)].map((m) => m[1] ?? "");
  const headingTexts = [...new Set([short(sentences(prompt)[0] ?? prompt, 80), ...quoted])].slice(0, 6);
  for (const [index, text] of headingTexts.entries()) {
    if (!text) continue;
    add(`heading_${index}`,
      `Heading with the exact text ${JSON.stringify(text)}. Include only when this is the requested title or heading.`,
      "Heading", { text, level: "h2" }, `text:${text}`);
  }

  // Profile: name/role/bio extracted from the request as literal props.
  const name = extractName(prompt);
  if (name) {
    const afterIdx = prompt.indexOf(name) + name.length;
    const after = prompt.slice(afterIdx).replace(/^[:,\-\s]+/, "");
    const role = after.split(/[,.;\n]/)[0]?.trim() ?? "";
    add("profile_avatar", "Avatar: profile avatar with initials from the person's name.",
      "Avatar", { src: null, name, size: "lg" }, "data:profile_avatar");
    add("profile_name", "Heading: display the person's name as read-only text.",
      "Heading", { text: name, level: "h2" }, "data:profile_name");
    if (role) {
      add("profile_role", "Text: display the person's role as read-only text.",
        "Text", { text: cap(short(role, 80)), variant: "lead" }, "data:profile_role");
    }
  }

  // Form field recipes (structure; values bind to per-request state).
  for (const [field, label, type] of [
    ["name", "Full name", "text"], ["email", "Email", "email"], ["password", "Password", "password"],
  ] as const) {
    add(`input_${field}`, `Input: editable ${label.toLowerCase()} field.`,
      "Input",
      {
        name: field, label, type, placeholder: null,
        value: { $bindState: `/form/${field}` },
        checks: [
          { type: "required", message: `${label} is required.` },
          ...(type === "email" ? [{ type: "email", message: "Enter a valid email address." }] : []),
        ],
      },
      `field:${field}`);
  }
  add("message", "Textarea: editable multi-line message.",
    "Textarea",
    { name: "message", label: "Message", placeholder: null, rows: 4,
      value: { $bindState: "/form/message" },
      checks: [{ type: "required", message: "Enter a message." }] },
    "field:message");
  add("topic", "Select: choose a contact topic from General, Billing, Technical.",
    "Select",
    { name: "topic", label: "Topic", options: ["General", "Billing", "Technical"],
      placeholder: null, value: { $bindState: "/form/topic" }, checks: null },
    "field:topic");
  add("remember", "Checkbox: remember me when signing in.",
    "Checkbox",
    { name: "remember", label: "Remember me", checked: { $bindState: "/form/remember" } },
    "field:remember");
  add("notifications_switch", "Switch: enable email notifications in account settings.",
    "Switch",
    { name: "notifications", label: "Email notifications", checked: { $bindState: "/form/notifications" } },
    "field:notifications");

  // Submit buttons: CTA verb from the request plus conventional fallbacks.
  const labels = [...new Set([ctaLabel(prompt), "Submit"].filter((l): l is string => Boolean(l)))];
  for (const [index, label] of labels.entries()) {
    add(`submit_${index}`,
      `Button labeled ${JSON.stringify(label)}. Bind press to the catalog's formSubmit action, which validates inputs and shows a demo toast.`,
      "Button", { label, variant: "primary", disabled: false },
      "action:submit",
      { press: { action: "formSubmit", params: { formName: "jev-form" } } });
  }
  add("save", "Button: Save changes. Bind press to setState to update the visible saved-status text. Local demo only.",
    "Button", { label: "Save changes", variant: "primary", disabled: false },
    "action:save",
    { press: { action: "setState", params: { statePath: "/status", value: "Changes saved locally." } } });
  add("reset", "Button: Reset. Bind press to setState to restore all form fields to their initial values.",
    "Button", { label: "Reset", variant: "outline", disabled: false },
    "action:reset",
    { press: { action: "setState", params: { statePath: "/form", value: structuredClone(initialFormState) } } });
  add("status", "Text: live save status, bound to /status. Include alongside Save changes.",
    "Text", { text: { $state: "/status" }, variant: "muted" }, "data:status");

  // Data values (numbers, lists, ratings) consider conversation history so
  // follow-ups can restore content introduced earlier ("add the chart back").
  // Identity (headings, names, CTAs) comes from the current request only.
  const dataText = history ? `${prompt}\n${history}` : prompt;

  // Data candidates from request numbers (metrics, chart, rating, progress).
  const rating = extractRating(dataText);
  const progress = extractProgress(dataText);
  const consumed: [number, number][] = [
    ...(rating ? [rating.span] : []),
    ...progress.map((p) => p.span),
  ];
  const numbers = extractNumbers(dataText, consumed);
  numbers.slice(0, 3).forEach((n, i) => {
    const props: Record<string, unknown> = { label: n.label, value: n.value, change: null, changeType: null, prefix: null, suffix: null };
    if (n.value.startsWith("$")) {
      props.value = n.value.slice(1);
      props.prefix = "$";
    }
    add(`metric_${i}`, `Metric: ${n.label}, ${n.value}. Request-extracted data.`,
      "Metric", props, `data:metric_${n.label.toLowerCase()}`);
  });
  if (numbers.length >= 2) {
    add("data_chart", "BarGraph: chart of the request's numbers.",
      "BarGraph",
      { title: null,
        data: numbers.slice(0, 6).map((n, i) => ({
          label: n.label && !/^metric \d+$/i.test(n.label) ? n.label : `Item ${i + 1}`,
          value: n.amount,
        })) },
      "data:chart");
  }
  if (rating) {
    add("data_rating", `Rating: ${rating.label}, ${rating.value} out of 5. Request-extracted data.`,
      "Rating", { label: rating.label, value: rating.value, max: 5, interactive: false },
      `data:rating_${rating.label.toLowerCase()}`);
  }
  progress.forEach((p, i) => {
    add(`progress_${i}`, `Progress: ${p.label}, ${p.value}%. Request-extracted data.`,
      "Progress", { label: p.label, value: p.value, max: 100 }, `data:progress_${p.label.toLowerCase()}`);
  });

  // Table rows from request list items (current request first, then history).
  const itemSources = [prompt, ...(history ? history.split("\n") : [])];
  let items: string[] = [];
  for (const source of itemSources) {
    const first = sentences(source)[0] ?? source;
    const parts = first.split(/[,;]|\s+and\s+/i)
      .map((s) => s.trim().replace(/^[^:;]{1,30}:\s*/, ""))
      .filter((s) => s.length > 0)
      .slice(0, 8);
    if (parts.length >= 2) {
      items = parts;
      break;
    }
  }
  if (items.length >= 2) {
    add("data_table", "Table: rows listed in the request.",
      "Table", { columns: ["Items"], rows: items.map((item) => [item]), caption: short(prompt) },
      "data:table");
  }

  add("separator", "Separator: horizontal dividing line, only when requested.",
    "Separator", { orientation: "horizontal" });

  return {
    candidates,
    initialState: { form: { ...initialFormState }, status: "No changes saved yet." },
  };
}

type SpecElement = {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  on?: UIElement["on"];
};

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Carry-forward candidates from the already-built spec. Follow-up requests
 * reference existing content ("make the chart bigger", "add the table back"),
 * so the same content must be offered as recipes. Every value comes from the
 * spec the user already has — nothing invented.
 */
export function buildCandidatesFromSpec(spec: {
  elements: Record<string, SpecElement>;
}): Candidate[] {
  const candidates: Candidate[] = [];
  function add(
    id: string,
    description: string,
    type: string,
    props: Record<string, unknown>,
    resource?: string,
    on?: UIElement["on"],
  ) {
    candidates.push({
      id,
      description,
      resource,
      root: false,
      maxUses: 1,
      element: { type, props, ...(on ? { on } : {}) },
    });
  }
  let i = 0;
  for (const el of Object.values(spec.elements)) {
    const p = el.props ?? {};
    switch (el.type) {
      case "Heading": {
        const text = str(p.text);
        if (text) add(`spec-heading-${i++}`, `Heading with the exact text ${JSON.stringify(text)}. Add to restore it.`,
          "Heading", { text, level: "h2" }, `text:${text}`);
        break;
      }
      case "Text": {
        const text = str(p.text);
        if (text && !text.startsWith("$state")) add(`spec-text-${i++}`, `Text with the exact content ${JSON.stringify(text)}. Add to restore it.`,
          "Text", { text, variant: (p.variant as string) ?? "body" }, `text:${text}`);
        break;
      }
      case "Metric": {
        const label = str(p.label);
        const value = str(p.value) ?? String(p.value ?? "");
        if (label && value) add(`spec-metric-${i++}`, `Metric: ${label}, ${value}. Already-built content. Add to restore it.`,
          "Metric",
          { label, value, change: p.change ?? null, changeType: p.changeType ?? null,
            prefix: p.prefix ?? null, suffix: p.suffix ?? null },
          `data:metric_${label.toLowerCase()}`);
        break;
      }
      case "Table": {
        if (Array.isArray(p.columns) && Array.isArray(p.rows) && p.rows.length > 0)
          add(`spec-table-${i++}`, "Table: already-built rows. Add to restore it.",
            "Table", { columns: p.columns, rows: p.rows, caption: (p.caption as string) ?? null },
            "data:table");
        break;
      }
      case "Rating": {
        if (typeof p.value === "number")
          add(`spec-rating-${i++}`, `Rating: ${String(p.label ?? "rating")}, ${p.value} out of 5. Already-built content. Add to restore it.`,
            "Rating", { label: p.label ?? null, value: p.value, max: (p.max as number) ?? 5, interactive: false },
            `data:rating_${String(p.label ?? "rating").toLowerCase()}`);
        break;
      }
      case "Progress": {
        if (typeof p.value === "number")
          add(`spec-progress-${i++}`, `Progress: ${String(p.label ?? "progress")}, ${p.value}%. Already-built content. Add to restore it.`,
            "Progress", { label: p.label ?? null, value: p.value, max: (p.max as number) ?? 100 },
            `data:progress_${String(p.label ?? "progress").toLowerCase()}`);
        break;
      }
      case "BarGraph":
      case "LineGraph": {
        if (Array.isArray(p.data) && p.data.length > 0)
          add(`spec-chart-${i++}`, `${el.type}: already-built chart. Add to restore it.`,
            el.type, { title: (p.title as string) ?? null, data: p.data }, "data:chart");
        break;
      }
      case "Input":
      case "Textarea":
      case "Select":
      case "Checkbox":
      case "Switch": {
        const nm = str(p.name);
        if (nm) add(`spec-field-${i++}`, `${el.type}: already-built ${str(p.label) ?? nm} field.`,
          el.type, { ...p }, `field:${nm}`, el.on);
        break;
      }
      case "Button": {
        const label = str(p.label);
        if (label) add(`spec-button-${i++}`, `Button labeled ${JSON.stringify(label)}. Already-built content.`,
          "Button", { ...p }, undefined, el.on);
        break;
      }
      case "Badge":
      case "Alert":
      case "Avatar": {
        add(`spec-${el.type.toLowerCase()}-${i++}`, `${el.type}: already-built content.`,
          el.type, { ...p }, undefined, el.on);
        break;
      }
      default:
        break;
    }
  }
  return candidates;
}
