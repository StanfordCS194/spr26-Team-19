const WORKER_PATH = "/workers/pyodide-runner.js";

type RunResult =
  | { ok: true; result: string; stdout: string }
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
