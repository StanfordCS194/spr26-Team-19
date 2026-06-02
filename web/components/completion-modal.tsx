"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export type CompletionAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type CompletionStat = {
  label: string;
  value: string;
};

type CompletionModalProps = {
  open: boolean;
  title: string;
  message?: string;
  /** Big featured result, e.g. placement level. */
  highlight?: CompletionStat;
  stats?: CompletionStat[];
  primaryAction?: CompletionAction;
  secondaryAction?: CompletionAction;
  onClose?: () => void;
  /** Emoji shown in the celebratory badge. */
  emoji?: string;
};

const CONFETTI_COLORS = ["#ec4899", "#0ea5e9", "#a855f7", "#f59e0b", "#22c55e"];

function Confetti() {
  // Deterministic positions so SSR/CSR match; purely decorative.
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-32 overflow-hidden" aria-hidden>
      {pieces.map((i) => (
        <span
          key={i}
          className="adapted-confetti"
          style={{
            left: `${(i * 5.5 + 4) % 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDelay: `${(i % 6) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

function ActionButton({
  action,
  variant,
}: {
  action: CompletionAction;
  variant: "primary" | "secondary";
}) {
  const cls =
    variant === "primary"
      ? "rounded-xl bg-gradient-to-r from-pink-500 to-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
      : "rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";

  if (action.href) {
    return (
      <Link href={action.href} onClick={action.onClick} className={cls}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={cls}>
      {action.label}
    </button>
  );
}

/**
 * Reusable celebration dialog. Use for placement completion, lesson mastery,
 * milestone achievements, etc. Supply a highlight + stats + actions.
 */
export function CompletionModal({
  open,
  title,
  message,
  highlight,
  stats,
  primaryAction,
  secondaryAction,
  onClose,
  emoji = "🎉",
}: CompletionModalProps) {
  const primaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    primaryRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="adapted-fade-in fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => onClose?.()}
    >
      <div
        className="adapted-pop-in relative w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-pink-100 via-white to-sky-100 px-8 pb-6 pt-10 text-center">
          <Confetti />
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-md ring-4 ring-white">
            <span aria-hidden>{emoji}</span>
          </div>
          <h2 className="relative mt-4 text-2xl font-black tracking-tight text-slate-900">
            {title}
          </h2>
          {message && <p className="relative mt-2 text-sm text-slate-700">{message}</p>}
        </div>

        <div className="px-8 pb-8 pt-6">
          {highlight && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                {highlight.label}
              </p>
              <p className="mt-1 text-3xl font-black text-slate-900">{highlight.value}</p>
            </div>
          )}

          {stats && stats.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-center"
                >
                  <dt className="text-xs font-medium text-slate-500">{stat.label}</dt>
                  <dd className="mt-0.5 text-lg font-bold text-slate-900">{stat.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {(primaryAction || secondaryAction) && (
            <div ref={primaryRef} className="mt-6 flex flex-wrap justify-center gap-3">
              {primaryAction && <ActionButton action={primaryAction} variant="primary" />}
              {secondaryAction && (
                <ActionButton action={secondaryAction} variant="secondary" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
