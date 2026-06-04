const WORKER_PATH = "/workers/pyodide-runner.js";

type RunResult =
  | { ok: true; result: string; stdout: string }
  | { ok: false; error: string };

/** A structured assertion run against the learner's namespace by the worker. */
export type SmartCheck = {
  id: string;
  /** Python boolean expression evaluated in the learner namespace after exec. */
  assert: string;
  message: string;
  capture?: string;
  skill?: string;
  targetVar?: string;
};

export type ValidationFailure = {
  checkId: string;
  skill: string;
  targetVar: string;
  message: string;
  actualRepr: string | null;
};

export type ValidationResult =
  | {
      ok: true;
      passed: boolean;
      error: { message: string; type: string; line: number | null } | null;
      failures: ValidationFailure[];
      answerRepr: string | null;
      stdout: string;
    }
  | { ok: false; error: string };

let worker: Worker | null = null;
let whenReady: Promise<void> | null = null;
const pending = new Map<number, (r: RunResult) => void>();
let nextId = 1;

/**
 * Spawns the Pyodide Web Worker and resolves when numpy is loaded (one-time).
 * Safe to call multiple times; returns the same promise.
 */
export function ensurePyodideWorker(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Pyodide worker is browser-only"));
  }
  if (whenReady) return whenReady;
  whenReady = new Promise((resolve, reject) => {
    const w = new Worker(WORKER_PATH);
    worker = w;
    w.onmessage = (e: MessageEvent) => {
      const d = e.data;
      if (d?.id != null && pending.has(d.id)) {
        if (d.ok === false) {
          pending.get(d.id)!({ ok: false, error: String(d.error ?? "Unknown error") });
        } else {
          pending.get(d.id)!({
            ok: true,
            result: String(d.result ?? ""),
            stdout: String(d.stdout ?? ""),
          });
        }
        pending.delete(d.id);
        return;
      }
      if (d?.type === "ready") {
        resolve();
        return;
      }
      if (d?.type === "error") {
        reject(new Error(d.error ?? "Pyodide failed to load in worker"));
      }
    };
    w.onerror = (err) => {
      reject(new Error(err.message || "Web Worker error"));
    };
  });
  return whenReady;
}

/**
 * Execute Python in the Pyodide worker. Captures `print` / stdout + stderr as `stdout`.
 * `code` is the full snippet (e.g. user code + `\\nrepr(answer)`).
 */
export function runPythonInWorker(code: string): Promise<RunResult> {
  return (async () => {
    await ensurePyodideWorker();
    if (!worker) {
      return { ok: false, error: "Worker not available" };
    }
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      worker!.postMessage({ id, cmd: "run", code });
    });
  })();
}
/**
 * Runs the learner's code and evaluates structured checks against it. Returns which checks
 * failed (tagged by skill) so the UI can render inline diagnostics and targeted fixes,
 * instead of a single pass/fail string.
 */
export function validatePythonInWorker(
  code: string,
  checks: SmartCheck[],
): Promise<ValidationResult> {
  return (async () => {
    await ensurePyodideWorker();
    if (!worker) {
      return { ok: false, error: "Worker not available" };
    }
    const id = nextId++;
    const raw = await new Promise<RunResult>((resolve) => {
      pending.set(id, resolve);
      worker!.postMessage({ id, cmd: "validate", code, checks });
    });
    if (!raw.ok) {
      return { ok: false, error: raw.error };
    }
    try {
      const parsed = JSON.parse(raw.result) as {
        passed: boolean;
        error: { message: string; type: string; line: number | null } | null;
        failures: ValidationFailure[];
        answerRepr?: string | null;
      };
      return {
        ok: true,
        passed: parsed.passed,
        error: parsed.error,
        failures: parsed.failures ?? [],
        answerRepr: parsed.answerRepr ?? null,
        stdout: raw.stdout,
      };
    } catch {
      return { ok: false, error: "Could not parse validation result" };
    }
  })();
}

