"use client";

import Image from "next/image";
import type { RouteStop, StopStatus } from "@/lib/numpy-route";

// Winding waypoints (percent of the container) tracing the trail on the art,
// flag (top-left) → trophy (bottom-right). One per curriculum unit.
const WORLD_WAYPOINTS: { x: number; y: number }[] = [
  { x: 16, y: 24 },
  { x: 30, y: 42 },
  { x: 44, y: 28 },
  { x: 55, y: 46 },
  { x: 68, y: 32 },
  { x: 80, y: 50 },
  { x: 88, y: 60 },
];

const WORLD_PIN: Record<StopStatus, string> = {
  complete: "bg-emerald-500 ring-emerald-200",
  current: "bg-fuchsia-500 ring-fuchsia-200",
  available: "bg-sky-500 ring-sky-200",
  locked: "bg-slate-400 ring-slate-200",
};

export function AdventureMap({
  stops,
  selectedId,
  onSelect,
}: {
  stops: RouteStop[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const points = stops.map((_, i) => WORLD_WAYPOINTS[Math.min(i, WORLD_WAYPOINTS.length - 1)]);
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-3xl border border-purple-100 shadow-inner">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-100 via-rose-50 to-purple-100" />
      <Image
        src="/numpy-journey-map.png"
        alt=""
        aria-hidden
        fill
        sizes="(max-width: 768px) 100vw, 640px"
        className="object-cover"
      />

      <svg
        viewBox="0 0 100 66.67"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <polyline
          points={polyline}
          fill="none"
          stroke="rgba(124,58,237,0.55)"
          strokeWidth="0.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2.4 2.4"
        />
      </svg>

      {stops.map((stop, i) => {
        const p = points[i];
        const locked = stop.status === "locked";
        const selected = stop.id === selectedId;
        return (
          <button
            key={stop.id}
            type="button"
            onClick={() => onSelect?.(stop.id)}
            className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 focus:outline-none"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            title={stop.label}
            aria-label={stop.label}
            aria-pressed={selected}
          >
            <span
              className={`relative grid h-10 w-10 place-items-center rounded-full text-lg text-white shadow-lg ring-4 ${WORLD_PIN[stop.status]} ${
                locked ? "opacity-70" : "transition group-hover:scale-110"
              } ${stop.status === "current" && !selected ? "animate-bounce" : ""} ${
                selected ? "scale-110 ring-amber-400" : ""
              }`}
              aria-hidden
            >
              {locked ? "🔒" : stop.icon}
              {stop.flagged && !locked && (
                <span
                  className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-amber-400 text-[9px] text-white shadow ring-2 ring-white"
                  title="Has a topic to review"
                >
                  !
                </span>
              )}
            </span>
            <span
              className={`max-w-[7rem] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold shadow ${
                selected ? "bg-amber-400 text-white" : "bg-white/90 text-slate-700"
              }`}
            >
              {stop.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
