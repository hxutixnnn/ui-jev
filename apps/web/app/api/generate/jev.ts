import { choice, noul } from "@typesafe-ai/sdk";

/**
 * Jev advises; code decides. One speculative fan-out call per prompt:
 *  - template: which code-owned page strategy to assemble
 *  - section Nouls: which blocks to include
 *  - safety Nouls: spam / PII / unsafe gate (defense in depth)
 *
 * Jev never writes JSON. The spec is assembled deterministically in
 * assemble.ts from these judgments plus prompt-extracted content.
 */
export function buildJevRequest(prompt: string) {
  const state = {
    user_prompt: prompt,
    templates: {
      dashboard:
        "Numbers, KPIs, metrics, stats, charts, analytics, performance, revenue",
      form: "Login, signup, sign-in, contact, subscribe, or any input form",
      landing:
        "Marketing page, hero, announcement, product intro, recipe, profile",
      list: "Rows, records, items, orders, inbox, alerts, tables, receipts, directories",
      profile:
        "A single person or entity: bio, avatar, role, testimonial subject",
    },
    guardrails:
      "The component catalog and assembly strategies are fixed in code. Pick the closest template; never invent components. Content is extracted from the prompt in code — judge structure only.",
  };

  const questions = {
    template: choice(
      "Which code-owned page strategy best fits this request?",
      {
        dashboard:
          "Metrics, KPIs, charts, numbers, analytics, performance, stats",
        form: "Login, signup, contact, subscribe, or data-entry form",
        landing:
          "Marketing, hero, announcement, recipe, product or content intro",
        list: "Rows, records, items, orders, inbox, receipts, tables, directories",
        profile: "One person or entity: bio, avatar, role, card",
        no_match: "None of the strategies fit — needs human review",
      },
    ),
    include_metrics: noul(
      "The page should show KPI / metric stat cards with numbers.",
    ),
    include_chart: noul(
      "The page should show a bar or line chart built from two or more numbers.",
    ),
    include_table: noul(
      "The page should show a data table with rows and columns.",
    ),
    include_inputs: noul(
      "The page should include form inputs (text, email, password, select).",
    ),
    include_rating: noul("The page should show a star rating."),
    include_progress: noul(
      "The page should show progress bars or completion percentages.",
    ),
    is_spam: noul(
      "This prompt is spam, bot noise, or test gibberish with no real UI intent.",
    ),
    contains_pii: noul(
      "The prompt contains personal data (email, phone, person name with contact details, address) that must not be echoed into the page.",
    ),
    unsafe_request: noul(
      "The request asks for phishing, credential harvesting, malware, or deceptive content.",
    ),
  };

  return { state, questions };
}
