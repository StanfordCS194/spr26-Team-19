/* eslint-disable no-restricted-globals -- Web Worker */
/**
 * Pyodide runs in this worker so heavy NumPy / Python work does not block the main thread
 * (Monaco + React stay responsive).
 */
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let pyodide = null;
let initPromise = null;

function getPyodide() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const p = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
    });
    await p.loadPackage("numpy");
    pyodide = p;
    return p;
  })();
  return initPromise;
}

getPyodide()
  .then(() => {
    self.postMessage({ type: "ready" });
  })
  .catch((e) => {
    self.postMessage({
      type: "error",
      error: e && e.message ? e.message : String(e),
    });
  });

self.onmessage = async (e) => {
  const { id, cmd, code } = e.data || {};
  if (cmd === "run" && code != null) {
    try {
      const p = await getPyodide();
      if (!p) {
        self.postMessage({ id, ok: false, error: "Pyodide not initialized" });
        return;
      }
      let out = "";
      p.setStdout({ batched: (s) => {
        out += s;
      } });
      p.setStderr({ batched: (s) => {
        out += s;
      } });
      const result = await p.runPythonAsync(code);
      const resultStr = result == null || result === undefined ? "" : String(result);
      self.postMessage({ id, ok: true, result: resultStr, stdout: out });
    } catch (err) {
      self.postMessage({
        id,
        ok: false,
        error: err && err.message ? err.message : String(err),
      });
    }
  }
};
