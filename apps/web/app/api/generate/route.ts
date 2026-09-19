import { headers } from "next/headers";
import { minuteRateLimit, dailyRateLimit } from "@/lib/rate-limit";
import { createCompositionResponse } from "@/lib/jev/response";

export const maxDuration = 60;

/**
 * Playground generation is Jev-only. Jev composes the UI from app-owned
 * atomic candidates through the experimental composer; code assembles and
 * validates the spec. No generative LLM calls. Live-only: no mock fallback.
 */
export async function POST(req: Request) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";

  const [minuteResult, dailyResult] = await Promise.all([
    minuteRateLimit.limit(ip),
    dailyRateLimit.limit(ip),
  ]);

  if (!minuteResult.success || !dailyResult.success) {
    const isMinuteLimit = !minuteResult.success;
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        message: isMinuteLimit
          ? "Too many requests. Please wait a moment before trying again."
          : "Daily limit reached. Please try again tomorrow.",
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { prompt, context } = await req.json();
  return createCompositionResponse(req, prompt, context?.previousSpec);
}
