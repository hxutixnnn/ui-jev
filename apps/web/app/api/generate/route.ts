import { headers } from "next/headers";
import { stringify as yamlStringify } from "yaml";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { minuteRateLimit, dailyRateLimit } from "@/lib/rate-limit";
import { playgroundCatalog } from "@/lib/render/catalog";
import { buildJevRequest } from "./jev";
import { decide } from "./policy";
import { assembleElements } from "./assemble";

export const maxDuration = 30;

const MAX_PROMPT_LENGTH = 500;
const STREAM_DELAY_MS = 90;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Playground generation without an LLM. Jev returns typed judgments
 * (template + sections + safety); code assembles the json-render spec
 * deterministically and streams it as JSONL patches (or a YAML fence),
 * keeping the existing playground client contract untouched.
 *
 * Live-only: no mock fallback. Missing TYPESAFE_API_KEY fails closed.
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
    return Response.json(
      {
        error: "Rate limit exceeded",
        message: isMinuteLimit
          ? "Too many requests. Please wait a moment before trying again."
          : "Daily limit reached. Please try again tomorrow.",
      },
      { status: 429 },
    );
  }

  const { prompt: rawPrompt, format } = await req.json();
  const prompt = String(rawPrompt ?? "").slice(0, MAX_PROMPT_LENGTH).trim();
  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!process.env.TYPESAFE_API_KEY) {
    return Response.json(
      { error: "TYPESAFE_API_KEY is not set — live Jev is required" },
      { status: 503 },
    );
  }

  let verdict;
  let usage = { input_tokens: 0, output_tokens: 0 };
  let model = "jev-latest";
  try {
    const client = new TypeSafeClient();
    const { state, questions } = buildJevRequest(prompt);
    const response = await client.systemOne({ state, questions });
    verdict = decide(response.answers);
    usage = {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
    };
    model = response.model ?? "jev-latest";
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Jev planner failed" },
      { status: 502 },
    );
  }

  if (verdict.action === "refuse") {
    return Response.json({ error: verdict.reasons[0] ?? "Held by policy" }, { status: 400 });
  }

  const { root, order, elements } = assembleElements(verdict, prompt);
  const spec = { root, elements };

  const validation = playgroundCatalog.validate(spec);
  if (!validation.success) {
    return Response.json(
      { error: "Assembled spec failed catalog validation" },
      { status: 500 },
    );
  }

  const usageMeta =
    `\n${JSON.stringify({
      __meta: "usage",
      promptTokens: usage.input_tokens,
      completionTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
      cachedTokens: 0,
      cacheWriteTokens: 0,
    })}\n` + `// ${verdict.action} ${verdict.template} via ${model}\n`;

  const encoder = new TextEncoder();

  if (format === "yaml") {
    const yamlText = `\`\`\`yaml-spec\n${yamlStringify(spec).trimEnd()}\n\`\`\`\n`;
    const chunkSize = Math.max(1, Math.floor(yamlText.length / 5));
    const stream = new ReadableStream({
      async start(controller) {
        for (let i = 0; i < yamlText.length; i += chunkSize) {
          controller.enqueue(encoder.encode(yamlText.slice(i, i + chunkSize)));
          await sleep(STREAM_DELAY_MS);
        }
        controller.enqueue(encoder.encode(usageMeta));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: string) => controller.enqueue(encoder.encode(`${line}\n`));
      send(JSON.stringify({ op: "add", path: "/root", value: root }));
      await sleep(STREAM_DELAY_MS);
      for (const key of order) {
        const node = elements[key];
        if (!node) continue;
        if (key === "page") {
          // Root shell first (empty children), wired at the end.
          const { children: _kids, ...rest } = node;
          void _kids;
          send(JSON.stringify({ op: "add", path: `/elements/${key}`, value: { ...rest, children: [] } }));
        } else {
          send(JSON.stringify({ op: "add", path: `/elements/${key}`, value: node }));
        }
        await sleep(STREAM_DELAY_MS);
      }
      send(
        JSON.stringify({
          op: "replace",
          path: "/elements/page/children",
          value: elements.page?.children ?? [],
        }),
      );
      controller.enqueue(encoder.encode(usageMeta));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
