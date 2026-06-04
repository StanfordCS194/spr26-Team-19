"use client";

import dynamic from "next/dynamic";
import type { OnMount } from "@monaco-editor/react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useId, useState, type ReactNode } from "react";
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { getSingletonHighlighter } from "shiki/bundle/web";

/** VS Code default light theme in Shiki (TextMate, same engine as VS Code). */
const SHIKI_THEME = "light-plus" as const;

const shikiReady = getSingletonHighlighter({
  themes: [SHIKI_THEME],
  langs: ["python"],
});

const MonacoEditor = dynamic(async () => (await import("@monaco-editor/react")).default, {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[4rem] items-center justify-center rounded-md border border-gray-200 bg-[#fffffe] text-sm text-gray-500">
      Loading editor…
    </div>
  ),
});

type PythonCodeBlockProps = {
  code: string;
  className?: string;
};

/** Read-only Python: Shiki + `light-plus` (VS Code–identical TextMate highlighting). */
export function PythonCodeBlock({ code, className }: PythonCodeBlockProps) {
  const [node, setNode] = useState<ReactNode>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const highlighter = await shikiReady;
        const hast = highlighter.codeToHast(code.trimEnd(), {
          lang: "python",
          theme: SHIKI_THEME,
        });
        const el = toJsxRuntime(hast, {
          Fragment,
          jsx,
          jsxs,
          elementAttributeNameCase: "react",
          components: {
            pre: (props) => (
              <pre
                className="m-0 overflow-x-auto rounded-md p-3 text-left text-[0.875rem] leading-normal"
                {...props}
              />
            ),
          },
        }) as ReactNode;
        if (!cancelled) setNode(el);
      } catch {
        if (!cancelled) {
          setNode(
            <pre className="m-0 whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-[0.875rem] text-gray-900">
              {code.trimEnd()}
            </pre>,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className={className}>
      {node ?? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
          Highlighting…
        </div>
      )}
    </div>
  );
}

type PythonCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  minHeight?: string;
  /** Distinct path so multiple editors on one page do not share a Monaco model. */
  modelPath?: string;
  /** Access the underlying editor + monaco instance (markers, code actions, etc.). */
  onMount?: OnMount;
};

/**
 * Editable Python using Monaco (same editor component as VS Code).
 * Theme `light` matches the default VS Code light chrome; pair with Shiki `light-plus` for read-only.
 */
export function PythonCodeEditor({
  value,
  onChange,
  className,
  minHeight = "12rem",
  modelPath: modelPathProp,
  onMount,
}: PythonCodeEditorProps) {
  const reactId = useId();
  const modelPath =
    modelPathProp ?? `inmemory:///python-${reactId.replace(/[^a-zA-Z0-9]/g, "-")}.py`;

  return (
    <MonacoEditor
      className={className}
      height={minHeight}
      path={modelPath}
      defaultLanguage="python"
      language="python"
      theme="light"
      value={value}
      onMount={onMount}
      onChange={(v) => onChange(v ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        automaticLayout: true,
        padding: { top: 8, bottom: 8 },
      }}
    />
  );
}
