"use client";

import { useEffect, useState } from "react";

type XPToastProps = {
  /** XP amount to display. Set to null to hide. */
  amount: number | null;
  /** Called after the exit animation finishes so the parent can clear the amount. */
  onDone: () => void;
};

/**
 * Small floating badge that pops in from the bottom-right corner when XP is
 * awarded. Auto-dismisses after 1.6 s with a fade-out transition.
 */
export function XPToast({ amount, onDone }: XPToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (amount === null) return;
    // Trigger enter on next tick so CSS transition fires.
    const enterTimer = setTimeout(() => setVisible(true), 10);
    // Start exit at 1.6 s, call onDone after transition completes.
    const exitTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 350);
    }, 1600);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [amount, onDone]);

  if (amount === null) return null;

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
