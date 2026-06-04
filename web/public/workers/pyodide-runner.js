/* eslint-disable no-restricted-globals -- Web Worker */
/**
 * Pyodide runs in this worker so heavy NumPy / Python work does not block the main thread
 * (Monaco + React stay responsive).
 */
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

let pyodide = null;
let initPromise = null;

/**
 * Runs the learner's code in an isolated namespace, then evaluates structured "checks"
 * (Python boolean expressions) against it. Returns which checks failed, tagged with the
 * skill they exercise, so the UI can map failures to inline diagnostics + fixes.
 * Reads `__USER_CODE__` and `__CHECKS_JSON__` from globals to avoid string-escaping issues.
 */
const VALIDATE_HARNESS = `
import json, traceback
import numpy as np

__ns = {"np": np, "numpy": np}
__error = None
try:
    exec(__USER_CODE__, __ns)
except Exception as __e:
    __line = None
    for __frame in traceback.extract_tb(__e.__traceback__):
        if __frame.filename == "<string>":
            __line = __frame.lineno
    __error = {"message": str(__e), "type": type(__e).__name__, "line": __line}

def _normalize_repr(s):
    return str(s).strip().replace(" ", "")

def _repr_matches(var_name, expected_list):
    if var_name not in __ns:
        return False
    got = _normalize_repr(repr(__ns[var_name]))
    return any(got == _normalize_repr(e) for e in expected_list)

__ns["_repr_matches"] = _repr_matches
__ns["json"] = json

__failures = []
if __error is None:
    for __c in json.loads(__CHECKS_JSON__):
        try:
            __passed = bool(eval(__c["assert"], __ns))
        except Exception:
            __passed = False
        if not __passed:
            __actual = None
            __cap = __c.get("capture")
            if __cap:
                try:
                    __actual = repr(eval(__cap, __ns))
                except Exception:
                    __actual = None
            __failures.append({
                "checkId": __c.get("id"),
                "skill": __c.get("skill") or "general",
                "targetVar": __c.get("targetVar") or "answer",
                "message": __c.get("message"),
                "actualRepr": __actual,
            })

__answer_repr = None
if __error is None and "answer" in __ns:
    try:
        __answer_repr = repr(__ns["answer"])
    except Exception:
        __answer_repr = None

json.dumps({
    "passed": __error is None and len(__failures) == 0,
    "error": __error,
    "failures": __failures,
    "answerRepr": __answer_repr,
})
`;

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
  const { id, cmd, code, checks } = e.data || {};
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
    return;
  }

  if (cmd === "validate" && code != null) {
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
      p.globals.set("__USER_CODE__", code);
      p.globals.set("__CHECKS_JSON__", JSON.stringify(checks ?? []));
      const result = await p.runPythonAsync(VALIDATE_HARNESS);
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
