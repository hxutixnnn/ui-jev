import { choice, noul, score } from "@typesafe-ai/sdk";

/**
 * Jev advises; code decides. One speculative fan-out call per prompt:
 *  - template/density: which code-owned template to assemble
 *  - section Nouls: which optional sections to include
 *  - safety Nouls: spam / PII / unsafe gate (defense in depth)
 *  - content_depth: supplementary signal for density fallback only
 */
export function buildJevRequest(prompt) {
  const state = {
    user_prompt: prompt,
    templates: {
      landing: "Marketing landing page: hero + logos + features + code sample + CTA",
      dashboard: "Metrics dashboard: KPI cards + chart/table + activity list",
      pricing: "Pricing page: tier cards + feature comparison + FAQ + CTA",
      auth_form: "Auth form: centered card with inputs + validation + submit",
      table_list: "Data list: table with rows + filters + pagination hint",
    },
    guardrails:
      "The catalog and templates are fixed in code. Pick the closest template; never invent components. Prefer landing unless the prompt clearly asks for numbers, tiers, login, or rows.",
  };

  const questions = {
    template: choice(
      "Which code-owned page template best fits this request?",
      {
        landing: "Marketing/hero content, features, announcement",
        dashboard: "Metrics, KPIs, charts, activity, stats",
        pricing: "Plans, tiers, per-month prices, feature comparison",
        auth_form: "Login, signup, sign-in form, authentication",
        table_list: "Rows, records, users, orders, table or list",
        no_match: "None of the templates fit — needs human review",
      },
    ),
    density: choice("How dense should the page feel?", {
      compact: "Dense dashboard or data-heavy view",
      comfortable: "Balanced default for most pages",
      spacious: "Airy marketing page with big hero",
    }),
    include_metrics: noul("The page should show KPI/metric stat cards."),
    include_table: noul("The page should show a data table with rows."),
    include_pricing: noul("The page should show pricing tier cards."),
    include_form: noul("The page should include an input form (signup/login/contact)."),
    include_code: noul("The page should show a code sample block."),
    include_testimonials: noul("The page should show testimonial or logo/social-proof content."),
    content_depth: score("How much content does this request need?", [
      "Minimal: single message or tiny card",
      "Small: one section with a few elements",
      "Medium: several sections (hero plus one or two blocks)",
      "Large: full page with many sections",
      "Very large: rich multi-section page",
    ]),
    is_spam: noul("This prompt is spam, bot noise, or test gibberish with no real UI intent."),
    contains_pii: noul("The prompt contains personal data (email, phone, name, address) that must not be echoed into the page."),
    unsafe_request: noul("The request asks for phishing, credential harvesting, malware, or deceptive content."),
  };

  return { state, questions };
}
