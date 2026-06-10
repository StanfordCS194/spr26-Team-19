"use client";

import { useEffect, useState } from "react";

type XPToastProps = {
  /** XP amount to display. Set to null to hide. */
  amount: number | null;
  /** When set, shows the larger level-up variant with the new tier. */
  levelUpTier?: { name: string; icon: string } | null;
  /** Called after the exit animation finishes so the parent can clear the amount. */
  onDone: () => void;
};

/**
 * Floating badge that pops up from the bottom-right when XP is awarded.
 * Renders a bigger, longer-lived celebration when `levelUpTier` is set.
 */
export function XPToast({ amount, levelUpTier, onDone }: XPToastProps) {
  const [visible, setVisible] = useState(false);
  const duration = levelUpTier ? 3200 : 1600;

  useEffect(() => {
    if (amount === null) return;
    const enterTimer = setTimeout(() => setVisible(true), 10);
    const exitTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 350);
    }, duration);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  if (amount === null) return null;

  if (levelUpTier) {
    return (
      <div
        aria-live="assertive"
        className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 rounded-2xl bg-gradient-to-r from-pink-500 to-sky-500 px-6 py-4 shadow-2xl transition-all duration-300 ${
          visible ? "translate-y-0 opacity-100 scale-100" : "translate-y-6 opacity-0 scale-95"
        }`}
      >
        <span className="text-3xl">{levelUpTier.icon}</span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Level up!</p>
          <p className="text-lg font-black text-white">{levelUpTier.name}</p>
          <p className="text-xs text-white/80">+{amount} XP</p>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 rounded-full border border-yellow-300 bg-white px-5 py-2.5 shadow-lg transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      <span className="text-xl">⭐</span>
      <span className="text-sm font-black text-yellow-700">+{amount} XP</span>
    </div>
  );
}
