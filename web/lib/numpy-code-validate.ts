import {
  validatePythonInWorker,
  type SmartCheck,
  type ValidationFailure,
  type ValidationResult,
} from "@/lib/pyodide-web-worker";

/** A Python boolean expression evaluated in the learner's namespace after their code runs. */
export type CodeChallengeCheck = {
  id: string;
  assert: string;
  message: string;
  capture?: string;
  skill?: string;
  targetVar?: string;
};

export type CodeChallengeSpec = {
  /** Legacy: converted to an env-side repr check when `checks` is omitted. */
  expectedOutputs?: string[];
  checks?: CodeChallengeCheck[];
};

export type ChallengeRunOutcome = {
  passed: boolean;
  message: string;
  runtimeError?: string;
  gotRepr?: string;
  failures: ValidationFailure[];
  stdout: string;
};

export function toWorkerChecks(checks: CodeChallengeCheck[]): SmartCheck[] {
  return checks.map((c) => ({
    id: c.id,
    assert: c.assert,
    message: c.message,
    capture: c.capture,
    skill: c.skill ?? "general",
    targetVar: c.targetVar ?? "answer",
  }));
}

/**
 * Legacy `expectedOutputs` → a single env check via `_repr_matches` (runs in Python, not TS).
 */
export function checksFromExpectedOutputs(expectedOutputs: string[]): CodeChallengeCheck[] {
  const payload = JSON.stringify(expectedOutputs);
  return [
    {
      id: "answer-expected",
      skill: "general",
      targetVar: "answer",
      assert: `_repr_matches("answer", json.loads(${JSON.stringify(payload)}))`,
      message: "Your answer doesn't match the expected result.",
      capture: "answer",
    },
  ];
}

/** Common curriculum checks (evaluated in the learner's Python namespace). */
export function checkAnswerSet(): CodeChallengeCheck {
  return {
    id: "answer-set",
    assert: "answer is not None",
    message: "Set the variable `answer` to your result.",
    capture: "answer",
  };
}

export function checkArrayEqual(expected: number[] | number[][]): CodeChallengeCheck {
  return {
    id: "array-values",
    assert: `np.array_equal(answer, np.array(${JSON.stringify(expected)}))`,
    message: "The array values don't match what we expected.",
    capture: "answer",
    skill: "array_construction",
  };
}

export function checkShape(shape: number[]): CodeChallengeCheck {
  const tuple = `(${shape.join(", ")})`;
  return {
    id: "shape",
    assert: `hasattr(answer, "shape") and tuple(answer.shape) == ${tuple}`,
    message: `Expected shape ${tuple}.`,
    capture: "answer",
    skill: "shapes",
  };
}

/** When `answer` is a shape tuple from `.shape`, not an ndarray. */
export function checkShapeTuple(shape: number[]): CodeChallengeCheck {
  const tuple = `(${shape.join(", ")})`;
  return {
    id: "shape-tuple",
    assert: `answer == ${tuple}`,
    message: `Expected shape ${tuple}.`,
    capture: "answer",
    skill: "shapes",
  };
}

export function checkScalar(value: number): CodeChallengeCheck {
  return {
    id: "scalar-value",
    assert: `np.asarray(answer).item() == ${value}`,
    message: `Expected the scalar ${value}.`,
    capture: "answer",
  };
}

/** Verify the learner created an input array (blocks hard-coded answers). */
export function checkSourceArray(
  varName: string,
  expected: number[] | number[][],
): CodeChallengeCheck {
  return {
    id: `source-${varName}`,
    assert: `isinstance(${varName}, np.ndarray) and np.array_equal(${varName}, np.array(${JSON.stringify(expected)}))`,
    message: `Create \`${varName}\` with the array from the prompt.`,
    capture: varName,
  };
}

/** Verify `answer` is derived from a source variable expression. */
export function checkDerivedAnswer(
  id: string,
  expr: string,
  message: string,
  skill?: string,
): CodeChallengeCheck {
  return {
    id,
    assert: expr,
    message,
    capture: "answer",
    ...(skill ? { skill } : {}),
  };
}

export function resolveChallengeChecks(spec: CodeChallengeSpec): CodeChallengeCheck[] {
  if (spec.checks?.length) return spec.checks;
  if (spec.expectedOutputs?.length) return checksFromExpectedOutputs(spec.expectedOutputs);
  return [
    {
      id: "answer-set",
      assert: "answer is not None",
      message: "Set the variable `answer` to your result.",
      capture: "answer",
    },
  ];
}

function formatOutcome(
  spec: CodeChallengeSpec,
  result: ValidationResult,
): ChallengeRunOutcome {
  if (!result.ok) {
    return {
      passed: false,
      message: result.error,
      failures: [],
      stdout: "",
    };
  }

  if (result.error) {
    return {
      passed: false,
      message: `${result.error.type}: ${result.error.message}`,
      runtimeError: result.error.message,
      failures: [],
      stdout: result.stdout,
    };
  }

  if (result.passed) {
    const repr = result.answerRepr?.trim();
    return {
      passed: true,
      message: repr ? `Passed. answer = ${repr}` : "Passed.",
      gotRepr: repr || undefined,
      failures: [],
      stdout: result.stdout,
    };
  }

  const first = result.failures[0];
  const gotRepr = first?.actualRepr?.trim() ?? result.answerRepr?.trim() ?? undefined;
  const expected =
    spec.expectedOutputs?.length && !spec.checks?.length
      ? spec.expectedOutputs.join(" | ")
      : null;
  const message = first?.message
    ? expected
      ? `${first.message} (expected one of: ${expected}${gotRepr ? `; got ${gotRepr}` : ""})`
      : `${first.message}${gotRepr ? ` (got ${gotRepr})` : ""}`
    : expected
      ? `Expected one of: ${expected}${gotRepr ? `; got ${gotRepr}` : ""}`
      : "Not quite — check your answer.";

  return {
    passed: false,
    message,
    gotRepr,
    failures: result.failures,
    stdout: result.stdout,
  };
}

/** Extract the first balanced `np.array(...)` literal from an assert string. */
function extractNpArrayLiteral(assert: string): string | null {
  const marker = "np.array(";
  const start = assert.indexOf(marker);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start + marker.length - 1; i < assert.length; i++) {
    const ch = assert[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return assert.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Clean up a grading message so it never falsely accuses the learner of
 * hard-coding (most failures are just a wrong answer) and never references a
 * source variable we inlined away. We keep the operation hint and drop the
 * scolding clause.
 */
function neutralizeMessage(message: string, sourceVars: string[]): string {
  let m = message ?? "";
  // Drop scolding clauses like "— don't hard-code [40, 50]." or "- do not type it".
  m = m.replace(/\s*[—–-]\s*(don'?t|do not|avoid|never|no)\b.*$/i, "");
  for (const v of sourceVars) {
    m = m.replace(new RegExp("`" + v + "\\.(\\w+)`", "g"), "the array's $1");
    m = m.replace(new RegExp("`" + v + "`", "g"), "the array");
  }
  // Strip any leftover "hard-code" wording just in case.
  m = m.replace(/\s*\b(don'?t|do not)\b[^.]*\bhard-?code\b[^.]*\.?/i, "");
  m = m.replace(/\s{2,}/g, " ").trim();
  return m.length >= 3 ? m : "That's not the expected result yet — check your operation.";
}

/**
 * Rewrite checks so grading only ever reads `answer`.
 *
 * Authored/generated checks often verify a named source array (e.g. `a`) and
 * then derive the result from it (`a[1:4]`). But the learner is only told to
 * set `answer`, never to name their array `a`, so a correct solution that uses
 * a different variable name fails. Here we:
 *   1. find source checks (capture is a non-`answer` variable holding an array literal),
 *   2. inline that literal wherever the variable appears in the other checks,
 *   3. drop the source-existence checks,
 *   4. neutralize messages so they don't falsely accuse hard-coding.
 * The expected value stays a computation (e.g. `np.array([10,20,30])[1:4]`),
 * so nothing is hard-coded — it just no longer depends on the learner's names.
 */
/**
 * Detect a source array variable that a check establishes a value for, reading
 * the assert text directly so we don't depend on the generator labelling
 * `capture` correctly (it often mislabels it as `answer`). Returns the variable
 * name (never `answer`) when the check verifies a named ndarray.
 */
function findSourceVar(assert: string): string | null {
  const iso = /\bisinstance\(\s*([A-Za-z_]\w*)\s*,\s*np\.ndarray\s*\)/.exec(assert);
  if (iso && iso[1] !== "answer") return iso[1];
  const eq = /\bnp\.array_equal\(\s*([A-Za-z_]\w*)\s*,\s*np\.array\(/.exec(assert);
  if (eq && eq[1] !== "answer") return eq[1];
  const tolist = /\b([A-Za-z_]\w*)\.tolist\(\)\s*==/.exec(assert);
  if (tolist && tolist[1] !== "answer") return tolist[1];
  return null;
}

export function selfContainChecks(checks: CodeChallengeCheck[]): CodeChallengeCheck[] {
  const sourceLiterals = new Map<string, string>();
  const sourceCheckIds = new Set<string>();

  for (const c of checks) {
    // Trust the assert text over `capture`: the generator frequently labels
    // every check's capture as `answer`, which hid the source array and made
    // correct learner answers fail because the inlined variable stayed undefined.
    const v = findSourceVar(c.assert) ?? (c.capture && c.capture !== "answer" ? c.capture : null);
    if (!v) continue;
    const literal = extractNpArrayLiteral(c.assert);
    if (literal) {
      sourceLiterals.set(v, literal);
      sourceCheckIds.add(c.id);
    }
  }

  const sourceVars = [...sourceLiterals.keys()];
  const nonSource = checks.filter((c) => !sourceCheckIds.has(c.id));
  const hasAnswerCheck = nonSource.some((c) => /\banswer\b/.test(c.assert));

  // Pure-creation task: the only checks verify a named array (e.g. `a`) and
  // nothing grades `answer`. The learner was told to set `answer`, so re-target
  // those checks to `answer` instead of dropping them (which would grade nothing).
  if (!hasAnswerCheck) {
    const retargeted = checks
      .filter((c) => sourceCheckIds.has(c.id))
      .map((c) => {
        let assert = c.assert;
        for (const v of sourceVars) {
          assert = assert.replace(new RegExp(`\\b${v}\\b`, "g"), "answer");
        }
        return { ...c, assert, message: neutralizeMessage(c.message, sourceVars) };
      });
    if (retargeted.length > 0) return retargeted;
  }

  const rewritten: CodeChallengeCheck[] = [];
  for (const c of nonSource) {
    let assert = c.assert;
    for (const [v, literal] of sourceLiterals) {
      assert = assert.replace(new RegExp(`\\b${v}\\b`, "g"), `(${literal})`);
    }
    rewritten.push({ ...c, assert, message: neutralizeMessage(c.message, sourceVars) });
  }

  return rewritten.length > 0 ? rewritten : checks;
}

/**
 * Run learner code in an isolated Python namespace and evaluate checks there.
 * All code-challenge surfaces should call this instead of `repr(answer)` + string compare.
 */
export async function runAndValidateChallenge(
  code: string,
  spec: CodeChallengeSpec,
): Promise<ChallengeRunOutcome> {
  const checks = selfContainChecks(resolveChallengeChecks(spec));
  const result = await validatePythonInWorker(code, toWorkerChecks(checks));
  return formatOutcome(spec, result);
}
