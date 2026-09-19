import { TypeSafeClient, noul } from "@typesafe-ai/sdk";

/**
 * Fail-closed safety pre-check. Runs before composition; spam, PII, and
 * unsafe requests are refused with a reason instead of rendered.
 */
export async function checkSafety(
  prompt: string,
  client = new TypeSafeClient(),
): Promise<string | null> {
  const { answers } = await client.systemOne({
    state: { user_prompt: prompt },
    questions: {
      is_spam: noul(
        "This prompt is spam, bot noise, or test gibberish with no real UI intent.",
      ),
      contains_pii: noul(
        "The prompt contains personal data (email, phone, person name with contact details, address) that must not be echoed into the page.",
      ),
      unsafe_request: noul(
        "The request asks for phishing, credential harvesting, malware, or deceptive content.",
      ),
    },
  });
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  if (num(answers.is_spam.noul) > 0.8)
    return `spam=${num(answers.is_spam.noul).toFixed(2)} — no real UI intent`;
  if (num(answers.contains_pii.noul) > 0.5)
    return `pii=${num(answers.contains_pii.noul).toFixed(2)} — personal data must not be echoed`;
  if (num(answers.unsafe_request.noul) > 0.6)
    return `unsafe=${num(answers.unsafe_request.noul).toFixed(2)} — deceptive or harmful request`;
  return null;
}
