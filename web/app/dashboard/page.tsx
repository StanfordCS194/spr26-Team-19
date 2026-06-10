"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  getSavedProblemsServerSnapshot,
  getSavedProblemsSnapshot,
  removeSavedProblem,
  subscribeSavedProblems,
} from "@/lib/numpy-saved-problems";
import {
  getXPServerSnapshot,
  getXPSnapshot,
  getTierForXP,
  getXPProgressInTier,
  getNextTier,
  subscribeXP,
} from "@/lib/xp-store";
import {
  getPlacementCompletedServerSnapshot,
  getPlacementCompletedSnapshot,
  loadNumpyPlacement,
  subscribePlacementCompleted,
} from "@/lib/numpy-placement-storage";
import {
  getProgressServerSnapshot,
  getProgressSnapshot,
  subscribeProgress,
} from "@/lib/numpy-progress-store";
import { buildUnitRoute } from "@/lib/numpy-route";

type User = {
  name: string;
  email: string;
  createdAt: string;
};

type Profile = {
  goal: string;
  skillLevel: string;
  motivation: string;
  preferredLibrary: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const savedProblems = useSyncExternalStore(
    subscribeSavedProblems,
    getSavedProblemsSnapshot,
    getSavedProblemsServerSnapshot,
  );
  const [placementLevel, setPlacementLevel] = useState<string | null>(null);

  const xpRecord = useSyncExternalStore(subscribeXP, getXPSnapshot, getXPServerSnapshot);
  const placementDone = useSyncExternalStore(
    subscribePlacementCompleted,
    getPlacementCompletedSnapshot,
    getPlacementCompletedServerSnapshot,
  );
  const progress = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getProgressServerSnapshot,
  );

  useEffect(() => {
    const savedUser = localStorage.getItem("adaptedCurrentUser");
    if (!savedUser) {
      router.push("/");
      return;
    }
    setUser(JSON.parse(savedUser));
    const savedProfile = localStorage.getItem("adaptedProfile");
    if (savedProfile) setProfile(JSON.parse(savedProfile));
    const placement = loadNumpyPlacement();
    if (placement) setPlacementLevel(placement.level);
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("adaptedCurrentUser");
    localStorage.removeItem("adaptedProfile");
    router.push("/");
  }

  if (!user) return null;

  const tier = getTierForXP(xpRecord.total);

  // Compute the "continue" target: the current unit stop on the learning path.
  // Only computed when placement is done so we have meaningful path data.
  const resumeStop = (() => {
    if (!placementDone) return null;
    const placement = loadNumpyPlacement();
    const stops = buildUnitRoute(placement, progress);
    const current = stops.find((s) => s.status === "current") ?? stops.find((s) => s.status === "available");
    return current ?? null;
  })();
  const nextTier = getNextTier(xpRecord.total);
  const xpProgress = getXPProgressInTier(xpRecord.total);

  return (
    <main className="relative min-h-screen overflow-hidden p-6 md:p-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-pink-200/40 blur-3xl" />
        <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-purple-200/30 blur-3xl" />
      </div>

      <section className="relative mx-auto w-full max-w-5xl">
        <div className="w-full rounded-3xl border border-white/70 bg-white/65 p-8 shadow-xl backdrop-blur md:p-10">

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-medium text-pink-700">
                Personalized learning
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                NumPy foundations
              </span>
            </div>
            <div className="flex gap-3">
              <Link
                href="/profile"
                className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Edit profile
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Log out
              </button>
            </div>
          </div>

          {/* Welcome */}
          <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-900 md:text-6xl">
            Hi, {user.name.split(" ")[0]} 👋
          </h1>
          {profile?.goal && (
            <p className="mt-2 max-w-2xl text-lg text-slate-700">{profile.goal}</p>
          )}

          {/* XP / Tier / Streak panel */}
          <div className="mt-6 rounded-2xl border border-white/80 bg-white/50 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Tier badge */}
              <div className="flex items-center gap-3">
                <span className="text-4xl">{tier.icon}</span>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-widest ${tier.colorClass}`}>
                    {tier.name}
                  </p>
                  <p className="text-2xl font-black text-slate-900">{xpRecord.total} XP</p>
                </div>
              </div>

              {/* Streak */}
              {xpRecord.streak > 0 && (
                <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2">
                  <span className="text-2xl">🔥</span>
                  <div>
                    <p className="text-sm font-bold text-amber-700">{xpRecord.streak}-day streak</p>
                    <p className="text-xs text-amber-600">Keep it going!</p>
                  </div>
                </div>
              )}

              {/* Placement level pill */}
              {placementLevel && (
                <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-center">
                  <p className="text-xs font-medium text-sky-600">Placement level</p>
                  <p className="text-sm font-bold text-slate-900">{placementLevel}</p>
                </div>
              )}
            </div>

            {/* XP progress bar toward next tier */}
            {nextTier && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>{tier.name}</span>
                  <span className="font-medium">
                    {xpProgress.xpInTier} / {xpProgress.tierSize} XP → {nextTier.name}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="adapted-xp-shimmer h-full rounded-full transition-all duration-500"
                    style={{ width: `${xpProgress.pct}%` }}
                  />
                </div>
              </div>
            )}

            {!nextTier && (
              <p className="mt-3 text-xs font-semibold text-sky-600">
                {tier.icon} Max tier reached — you&apos;re at the top!
              </p>
            )}

            {/* XP legend */}
            <p className="mt-3 text-xs text-slate-400">
              +10 XP per correct MCQ · +25 XP code first try · +50 XP placement complete
            </p>
          </div>

          {/* Onboarding guide — only shown before placement is done */}
          {!placementDone && (
            <div className="mt-6 rounded-2xl border-2 border-sky-300 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-600">Get started</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900">3 steps to your personalized path</h2>
              <ol className="mt-4 space-y-3">
                {([
                  { done: true,        label: "Create your account",                   href: null,             cta: null },
                  { done: !!profile,   label: "Set your learning goal",                href: "/profile",       cta: "Set goal →" },
                  { done: false,       label: "Find your level  (~5 min quiz)",        href: "/find-my-level", cta: "Start now →" },
                ] as { done: boolean; label: string; href: string | null; cta: string | null }[]).map((step, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.done ? "bg-emerald-100 text-emerald-700" : i === (profile ? 2 : 1) ? "bg-sky-600 text-white" : "bg-slate-200 text-slate-500"}`}>
                      {step.done ? "✓" : i + 1}
                    </div>
                    <span className={`flex-1 text-sm ${step.done ? "text-slate-400 line-through" : "font-medium text-slate-900"}`}>
                      {step.label}
                    </span>
                    {!step.done && step.href && (
                      <Link
                        href={step.href}
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${i === (profile ? 2 : 1) ? "bg-sky-600 text-white hover:bg-sky-700" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                      >
                        {step.cta}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Profile pills */}
          {profile && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                {profile.skillLevel}
              </span>
              <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-medium text-pink-700">
                {profile.motivation}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {profile.preferredLibrary}
              </span>
            </div>
          )}

          {/* Saved problems */}
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">★ Saved problems</h2>
              <span className="text-xs text-slate-500">{savedProblems.length} saved</span>
            </div>
            {savedProblems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                Bookmark a code task with{" "}
                <span className="font-medium text-amber-700">☆ Save problem</span> in the{" "}
                <Link href="/numpy/exercises?tab=code" className="font-medium text-sky-700 hover:underline">
                  code lab
                </Link>{" "}
                and it&apos;ll show up here to revisit.
              </p>
            ) : (
              <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                {savedProblems.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/80 bg-white/80 p-3 shadow-sm"
                  >
                    <Link
                      href={`/numpy/exercises?saved=${encodeURIComponent(p.id)}`}
                      className="group min-w-0 flex-1"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                        {p.topic}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-800 group-hover:text-sky-700">
                        {p.prompt}
                      </p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeSavedProblem(p.id)}
                      aria-label="Remove saved problem"
                      className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Resume card — shown when placement is done and there's an active unit */}
          {placementDone && resumeStop && (
            <Link
              href={resumeStop.href ?? "/numpy/path"}
              className="mt-6 flex items-center justify-between gap-4 rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{resumeStop.icon}</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Continue where you left off</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">{resumeStop.label}</p>
                  {resumeStop.percent !== null && (
                    <p className="text-xs text-slate-500">{resumeStop.percent}% mastered</p>
                  )}
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                Resume →
              </span>
            </Link>
          )}

          {/* Learning path cards */}
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Link
              href="/numpy/lessons"
              className="group rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-600">
                Guided
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Lessons</h2>
              <p className="mt-2 text-sm text-slate-700">
                Build intuition with interactive visuals, guided practice, and core NumPy concepts.
              </p>
              <p className="mt-4 text-sm font-semibold text-pink-700 transition group-hover:translate-x-1">
                Start learning →
              </p>
            </Link>

            <Link
              href="/numpy/exercises"
              className="group rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                Practice
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Exercises</h2>
              <p className="mt-2 text-sm text-slate-700">
                AI-generated MCQ drills and coding tasks. Earn XP for every correct answer.
              </p>
              <p className="mt-4 text-sm font-semibold text-indigo-700 transition group-hover:translate-x-1">
                Practice now →
              </p>
            </Link>

            <Link
              href={placementDone ? "/numpy/path" : "/find-my-level"}
              className="group rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                {placementDone ? "Your path" : "Adaptive"}
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                {placementDone ? "Learning path" : "Find my level"}
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                {placementDone
                  ? "Your personalized journey map — units, mastery progress, and what to tackle next."
                  : "Take a quick diagnostic and get a recommended starting level in minutes."}
              </p>
              <p className="mt-4 text-sm font-semibold text-sky-700 transition group-hover:translate-x-1">
                {placementDone ? "View path →" : "Start diagnostic →"}
              </p>
            </Link>
          </div>

        </div>
      </section>
    </main>
  );
}
