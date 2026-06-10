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

/**
 * Run learner code in an isolated Python namespace and evaluate checks there.
 * All code-challenge surfaces should call this instead of `repr(answer)` + string compare.
 */
export async function runAndValidateChallenge(
  code: string,
  spec: CodeChallengeSpec,
): Promise<ChallengeRunOutcome> {
  const checks = resolveChallengeChecks(spec);
  const result = await validatePythonInWorker(code, toWorkerChecks(checks));
  return formatOutcome(spec, result);
}
