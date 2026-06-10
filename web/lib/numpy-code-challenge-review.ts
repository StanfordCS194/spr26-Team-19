import { groqJsonChat } from "@/lib/groq-json-chat";
import type { CodeChallengeCheck } from "@/lib/numpy-code-validate";

export type ChallengeReviewInput = {
  id: string;
  topic: string;
  prompt: string;
  checks: CodeChallengeCheck[];
  hint: string;
  targetDifficulty: "easy" | "medium" | "hard";
  focusTopic: string;
  lessonId?: string;
  taskGuide?: string;
};

export type ChallengeReviewResult = {
  approved: boolean;
  issues: string[];
  /** Plain-English prompt rewrite when checks are fine but wording is wrong. */
  revisedPrompt: string | null;
};

function parseReviewContent(content: string): ChallengeReviewResult | null {
  const normalized = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(normalized) as Record<string, unknown>;
  if (typeof parsed.approved !== "boolean") return null;
  if (!Array.isArray(parsed.issues) || !parsed.issues.every((i) => typeof i === "string")) {
    return null;
  }
  const revisedPrompt =
    parsed.revisedPrompt === null || parsed.revisedPrompt === undefined
      ? null
      : typeof parsed.revisedPrompt === "string"
        ? parsed.revisedPrompt.trim() || null
        : null;
  return {
    approved: parsed.approved,
    issues: parsed.issues as string[],
    revisedPrompt,
  };
}

/**
 * Secondary LLM pass: sanity-check prompt wording, counts, difficulty, and
 * alignment with grading checks before showing the task to learners.
 */
export async function reviewCodeChallengeWithLlm(
  apiKey: string,
  model: string,
  challenge: ChallengeReviewInput,
): Promise<ChallengeReviewResult | null> {
  const payload = JSON.stringify({
    difficulty: challenge.targetDifficulty,
    curriculumLesson: challenge.focusTopic,
    lessonId: challenge.lessonId,
    taskGuide: challenge.taskGuide,
    prompt: challenge.prompt,
    hint: challenge.hint,
    checks: challenge.checks.map((c) => c.assert),
  });

  const reviewPrompt = `Review this NumPy drill for a specific curriculum lesson. Learner sees prompt+hint only; grading uses checks (Python).

${payload}

Verify: (1) exercise matches the curriculum taskGuide, (2) checks are internally consistent, (3) prompt matches checks, (4) sensible for difficulty, (5) prompt has no Python code but DOES use digit literals (5, 15) — reject spelled-out numbers ("five", "fifteen"), (6) hint nudges without full answer.

APPROVE (possibly with revisedPrompt) when:
- Checks build a source array then derive answer (slice, shape, sum, etc.) and prompt describes that same operation.
- Wording is vague but fixable — rewrite prompt with digit literals (e.g. 10, 20, 30), not spelled-out words.
- REJECT even-length arrays (4, 6, … values) with singular "middle element" — use an index or "two middle elements".

REJECT (approved=false) ONLY for hard contradictions:
- Impossible math (reshape 6 elements to 3×3, etc.)
- Checks grade a different operation than the prompt (prompt asks for slice but check expects np.array_equal(answer, a))
- Checks and prompt require incompatible array sizes

Do NOT reject just because "middle N" sounds ambiguous — fix the prompt instead.

Return JSON: {"approved":bool,"issues":["..."],"revisedPrompt":string|null}
- approved=true + revisedPrompt when checks are good but prompt should be clearer
- approved=false only for hard contradictions listed above`;

  const content = await groqJsonChat(
    apiKey,
    model,
    [
      {
        role: "system",
        content:
          "You QA NumPy exercises. Prefer approving with a clearer revisedPrompt over rejecting. Only reject hard prompt/check contradictions. Return only JSON.",
      },
      { role: "user", content: reviewPrompt },
    ],
    0.15,
  );

  if (!content) return null;

  try {
    return parseReviewContent(content);
  } catch (error) {
    console.error("Failed to parse challenge review JSON", { content, error });
    return null;
  }
}
