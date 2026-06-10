"use client";

import { useEffect, useState } from "react";
import type { Badge } from "@/lib/achievements";

type BadgeToastProps = {
  badge: Badge | null;
  onDone: () => void;
};

/**
 * Bottom-left toast shown when a badge is earned for the first time.
 * Sits opposite the XPToast (bottom-right) so they can show simultaneously.
 */
export function BadgeToast({ badge, onDone }: BadgeToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!badge) return;
    const enter = setTimeout(() => setVisible(true), 10);
    const exit  = setTimeout(() => { setVisible(false); setTimeout(onDone, 350); }, 2400);
    return () => { clearTimeout(enter); clearTimeout(exit); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badge]);

  if (!badge) return null;

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-6 left-6 z-[200] flex items-center gap-3 rounded-2xl border border-purple-200 bg-white px-5 py-3 shadow-lg transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <span className="text-2xl">{badge.icon}</span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-purple-500">
          Badge unlocked
        </p>
        <p className="text-sm font-black text-slate-900">{badge.name}</p>
      </div>
    </div>
  );
}
