"use client";

/** Circular progress for exercise zone (0–100, or null = no attempts yet). */
export function ExerciseProgressRing({ percent }: { percent: number | null }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const p = percent == null ? 0 : Math.min(100, Math.max(0, percent));
  const offset = c * (1 - p / 100);

  return (
    <div className="flex items-center gap-3">
      <svg width="104" height="104" viewBox="0 0 104 104" className="shrink-0" aria-hidden>
        <circle cx="52" cy="52" r={r} fill="none" className="stroke-slate-200" strokeWidth="10" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          className="stroke-emerald-500 transition-[stroke-dashoffset] duration-300"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 52 52)"
        />
      </svg>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Exercise accuracy
        </p>
        <p className="text-2xl font-bold text-slate-900">
          {percent == null ? "—" : `${percent}%`}
        </p>
        <p className="text-xs text-slate-500">MCQ drill + code lab combined</p>
      </div>
    </div>
  );
}
