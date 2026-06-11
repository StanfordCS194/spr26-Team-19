import { NextResponse } from "next/server";
import { groqJsonChat } from "@/lib/groq-json-chat";
import {
  isWeakCodeChallenge,
  pickCuratedCodeChallenge,
  promptHasCodeLiterals,
} from "@/lib/numpy-code-challenge-quality";
import { reviewCodeChallengeWithLlm } from "@/lib/numpy-code-challenge-review";
import {
  buildCurriculumGenerationContext,
  lessonById,
  resolveLessonForFocus,
} from "@/lib/numpy-code-topics";
import type { CodeChallengeCheck } from "@/lib/numpy-code-validate";
import { MINIMAL_STARTER_CODE } from "@/lib/numpy-starter-code";
import { normalizePromptDigits } from "@/lib/numpy-prompt-style";

type Difficulty = "easy" | "medium" | "hard";

type RequestBody = {
  focusTopic?: string;
  /** Preferred: explicit curriculum lesson id from client rotation. */
  lessonId?: string;
  difficulty?: Difficulty;
  seenPrompts?: string[];
  reinforceWeakTopic?: string;
};

type ParsedChallenge = {
  id: string;
  topic: string;
  prompt: string;
  starterCode: string;
  checks: CodeChallengeCheck[];
  hint: string;
};

function buildPrompt(
  difficulty: Difficulty,
  lessonContext: string,
  reinforce: string | undefined,
  seenBlock: string,
): string {
  return `
Generate ONE NumPy coding exercise as strict JSON for the curriculum lesson below.
Difficulty: ${difficulty}.
${reinforce ? `Learner struggled with "${reinforce}" — simpler variant of the SAME lesson skill.` : ""}
${seenBlock}

${lessonContext}

Learner sets variable \`answer\`. Grading runs Python \`checks\` after their code.

Schema:
{"id":"kebab-case","topic":"exact lesson focus string","prompt":"plain English","starterCode":"import numpy as np","checks":[{"id":"string","assert":"python expr","message":"string","capture":"answer"}],"hint":"string"}

Rules:
- Match the lesson "Task type" above — do NOT default to generic 1D slice unless that lesson is indexing/slicing.
- Prompt style: short and natural. State data values with normal digits (5, 15, 25, 35) — NEVER spell numbers as words ("five", "fifteen").
- Forbidden in prompt: Python code, assignments, np.* calls. Allowed: digit lists, index positions (0-based), shapes like 3×2.
- Example prompt: "Build a 1D array from 5, 15, 25, and 35. Set answer to the element at index 2."
- Never use "the middle element" on even-length arrays (4 values has no single middle) — use an index or "two middle elements".
- Exactly 2 checks: (1) source exists with expected values (2) answer derived from source.
- Check "message": describe what \`answer\` should be (e.g. "answer should be the last two elements"). Do NOT accuse the learner of hard-coding — a wrong answer is just wrong.
- Vary numbers from any reference exercise.
- starterCode: import numpy as np
`;
}

function parseChallengeContent(content: string): ParsedChallenge | null {
  const normalizedContent = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(normalizedContent) as Record<string, unknown>;

  const checksRaw = parsed.checks;
  const checksValid =
    Array.isArray(checksRaw) &&
    checksRaw.length >= 2 &&
    checksRaw.length <= 4 &&
    checksRaw.every((c) => {
      if (!c || typeof c !== "object") return false;
      const row = c as Record<string, unknown>;
      return (
        typeof row.id === "string" &&
        typeof row.assert === "string" &&
        typeof row.message === "string" &&
        (row.capture === undefined || typeof row.capture === "string")
      );
    });

  if (
    typeof parsed.id !== "string" ||
    typeof parsed.topic !== "string" ||
    typeof parsed.prompt !== "string" ||
    typeof parsed.starterCode !== "string" ||
    typeof parsed.hint !== "string" ||
    !checksValid
  ) {
    return null;
  }

  return {
    id: parsed.id,
    topic: parsed.topic,
    prompt: parsed.prompt,
    starterCode: parsed.starterCode,
    checks: checksRaw as CodeChallengeCheck[],
    hint: parsed.hint,
  };
}

async function requestChallengeFromLlm(
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<ParsedChallenge | null> {
  const content = await groqJsonChat(
    apiKey,
    model,
    [
      {
        role: "system",
        content:
          "You write NumPy drills tied to a curriculum lesson. Prompts use digit literals (5, 15), never spelled-out numbers. No Python code in prompts. JSON only.",
      },
      { role: "user", content: userPrompt },
    ],
    0.55,
  );

  if (!content) return null;

  try {
    return parseChallengeContent(content);
  } catch (error) {
    console.error("Failed to parse code challenge JSON", { content, error });
    return null;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured." },
      { status: 503 },
    );
  }

  const body = (await req.json()) as RequestBody;
  const reinforce = body.reinforceWeakTopic?.trim();
  const difficulty: Difficulty =
    reinforce ? "easy" : (body.difficulty ?? "medium");
  const lesson =
    lessonById(body.lessonId) ??
    resolveLessonForFocus(
      reinforce || body.focusTopic?.trim() || "indexing and slicing",
    );
  const lessonContext = buildCurriculumGenerationContext(lesson);
  const seenBlock =
    body.seenPrompts?.length
      ? `\nAvoid repeating:\n${body.seenPrompts.slice(0, 6).map((p, i) => `${i + 1}. ${p}`).join("\n")}\n`
      : "";

  const model = process.env.GROQ_MODEL ?? "groq/compound-mini";
  const reviewModel = process.env.GROQ_REVIEW_MODEL ?? model;
  const basePrompt = buildPrompt(difficulty, lessonContext, reinforce, seenBlock);

  let challenge: ParsedChallenge | null = null;
  // Feedback from the prior attempt's QA/review, fed back into the prompt so the
  // generator can correct the specific issue instead of blindly retrying.
  let retryFeedback = "";
  let source: "generated" | "generated-unreviewed" | "curriculum" | "curated" = "generated";

  // Up to 3 passes: generate → cheap programmatic QA → LLM review. Any failure
  // records feedback and retries; exhausting all 3 falls back to a curated drill.
  for (let attempt = 0; attempt < 3; attempt++) {
    const retryNote = retryFeedback
      ? `\nFIX THESE QA ISSUES:\n${retryFeedback}\n`
      : "";

    challenge = await requestChallengeFromLlm(apiKey, model, basePrompt + retryNote);
    if (!challenge) {
      retryFeedback = "Invalid JSON from generator.";
      challenge = null;
      continue;
    }

    // Pass 1 — fast, deterministic, free: reject prompts with code literals or
    // checks that are shortcuttable before spending a second LLM call on review.
    const programmaticReason =
      (promptHasCodeLiterals(challenge.prompt)
        ? "prompt contains code literals"
        : null) ?? isWeakCodeChallenge(challenge.prompt, challenge.checks);

    if (programmaticReason) {
      console.warn("Code challenge failed programmatic QA", {
        reason: programmaticReason,
        id: challenge.id,
        lesson: lesson.id,
      });
      retryFeedback = programmaticReason;
      challenge = null;
      continue;
    }

    // Pass 2 — second LLM judges wording/difficulty/check-alignment and may
    // return a clearer revisedPrompt instead of an outright rejection.
    const review = await reviewCodeChallengeWithLlm(apiKey, reviewModel, {
      id: challenge.id,
      topic: challenge.topic,
      prompt: challenge.prompt,
      checks: challenge.checks,
      hint: challenge.hint,
      targetDifficulty: difficulty,
      focusTopic: lesson.focus,
      lessonId: lesson.id,
      taskGuide: lessonContext,
    });

    if (!review) {
      // Reviewer unavailable (parse/API failure): trust programmatic QA rather
      // than discarding an otherwise-valid challenge. Tagged so we can tell apart.
      console.warn("Reviewer skipped; using programmatic QA only", {
        id: challenge.id,
        lesson: lesson.id,
      });
      source = "generated-unreviewed";
      break;
    }

    if (!review.approved) {
      console.warn("Code challenge rejected by reviewer", {
        id: challenge.id,
        lesson: lesson.id,
        issues: review.issues,
      });
      retryFeedback = review.issues.join("; ");
      challenge = null;
      continue;
    }

    if (review.revisedPrompt && review.revisedPrompt !== challenge.prompt) {
      if (promptHasCodeLiterals(review.revisedPrompt)) {
        retryFeedback = "Reviewer revised prompt contained code literals.";
        challenge = null;
        continue;
      }
      challenge = { ...challenge, prompt: normalizePromptDigits(review.revisedPrompt) };
    }

    challenge = {
      ...challenge,
      topic: lesson.focus,
      prompt: normalizePromptDigits(challenge.prompt),
    };
    source = "generated";
    break;
  }

  if (!challenge) {
    const curated = pickCuratedCodeChallenge(lesson.focus);
    return NextResponse.json({
      ...curated,
      starterCode: MINIMAL_STARTER_CODE,
      source: curated.id.startsWith("curriculum-") ? "curriculum" : "curated",
    });
  }

  return NextResponse.json({
    id: challenge.id,
    topic: challenge.topic,
    prompt: challenge.prompt,
    starterCode: MINIMAL_STARTER_CODE,
    checks: challenge.checks,
    hint: challenge.hint,
    source,
    lessonId: lesson.id,
  });
}
