import { TypeSafeClient, choice, type EntryType } from "@typesafe-ai/sdk";
import type {
  Experimental_CompositionEvaluator,
  Experimental_ChoiceQuestion,
} from "@json-render/core";

/**
 * Direct TypeSafe evaluator for the experimental composer. Implements the
 * provider-independent Experimental_CompositionEvaluator interface on top of
 * the TypeSafe SDK, so no Vercel AI Gateway key or provider allowlisting is
 * needed. Only Choice questions are used by the composer.
 *
 * Server-side only: reads TYPESAFE_API_KEY from the environment.
 */
export function createDirectEvaluator(
  client = new TypeSafeClient(),
): Experimental_CompositionEvaluator {
  return async ({
    state,
    questions,
    signal,
  }: {
    state: Record<string, unknown>;
    questions: Record<string, Experimental_ChoiceQuestion>;
    signal: AbortSignal;
  }) => {
    signal.throwIfAborted();
    const built: Record<string, ReturnType<typeof choice>> = {};
    for (const [name, q] of Object.entries(questions)) {
      built[name] = choice(q.instructions, q.criteria);
    }
    const response = await client.systemOne(
      { state: state as EntryType, questions: built },
      { signal },
    );
    const answers: Record<string, { choice: string; confidence?: number }> = {};
    for (const [name, q] of Object.entries(questions)) {
      const answer = (response.answers as Record<string, { choice: string; confidence?: number }>)[name];
      if (!answer || !Object.hasOwn(q.criteria, answer.choice)) {
        throw new Error(
          `Evaluator returned a choice outside the offered criteria (${name}).`,
        );
      }
      answers[name] = { choice: answer.choice, confidence: answer.confidence };
    }
    const inputTokens = response.usage?.input_tokens;
    return {
      answers,
      ...(inputTokens === undefined ? {} : { usage: { inputTokens } }),
    };
  };
}
