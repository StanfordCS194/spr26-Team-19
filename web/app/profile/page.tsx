"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  getPlacementCompletedServerSnapshot,
  getPlacementCompletedSnapshot,
  loadNumpyPlacement,
  subscribePlacementCompleted,
} from "@/lib/numpy-placement-storage";
import {
  getXPServerSnapshot,
  getXPSnapshot,
  getTierForXP,
  getXPProgressInTier,
  getNextTier,
  subscribeXP,
} from "@/lib/xp-store";

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

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile>({
    goal: "",
    skillLevel: "Beginner",
    motivation: "Casual learning",
    preferredLibrary: "NumPy",
  });
  const [placementLevel, setPlacementLevel] = useState<string | null>(null);

  const placementDone = useSyncExternalStore(
    subscribePlacementCompleted,
    getPlacementCompletedSnapshot,
    getPlacementCompletedServerSnapshot,
  );

  const xpRecord = useSyncExternalStore(subscribeXP, getXPSnapshot, getXPServerSnapshot);
  const tier = getTierForXP(xpRecord.total);
  const nextTier = getNextTier(xpRecord.total);
  const xpProgress = getXPProgressInTier(xpRecord.total);

  useEffect(() => {
    const savedUser = localStorage.getItem("adaptedCurrentUser");

    if (!savedUser) {
      router.push("/");
      return;
    }

    setUser(JSON.parse(savedUser));

    const savedProfile = localStorage.getItem("adaptedProfile");
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }

    const placement = loadNumpyPlacement();
    if (placement) setPlacementLevel(placement.level);
  }, [router]);

  function handleSaveProfile() {
    localStorage.setItem("adaptedProfile", JSON.stringify(profile));
    router.push(placementDone ? "/dashboard" : "/find-my-level");
  }

  function handleLogout() {
    localStorage.removeItem("adaptedCurrentUser");
    localStorage.removeItem("adaptedProfile");
    router.push("/");
  }

  if (!user) return null;

  return (
    <main className="relative min-h-screen overflow-hidden p-6 md:p-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-pink-200/40 blur-3xl" />
        <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-purple-200/30 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-[85vh] w-full max-w-5xl items-center justify-center">
        <div className="w-full rounded-3xl border border-white/70 bg-white/65 p-8 shadow-xl backdrop-blur md:p-12">

          <Link href="/dashboard" className="text-sm font-medium text-sky-700 hover:underline">
            ← Back to dashboard
          </Link>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-medium text-pink-700">
              Learner profile
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              Your path
            </span>
          </div>

          {!placementDone && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">1</div>
              <p className="text-sm text-slate-700">
                <span className="font-semibold">Step 1 of 2:</span> Set your learning goal, then we&apos;ll run a quick diagnostic to find your level.
              </p>
            </div>
          )}

          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            {placementDone ? "Your profile" : "Let's get you set up"}
          </h1>

          <p className="mt-4 max-w-2xl text-lg text-slate-700">
            Hi {user.name}! {placementDone ? "Update your learning preferences below." : "Tell us how you want to learn — takes 30 seconds."}
          </p>

          {/* ── Gamification stats (only shown after placement) ── */}
          {placementDone && xpRecord.total > 0 && (
            <div className="mt-6 rounded-2xl border border-white/80 bg-white/50 p-5 shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Your stats</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
                {/* Tier + XP */}
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{tier.icon}</span>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-widest ${tier.colorClass}`}>{tier.name}</p>
                    <p className="text-xl font-black text-slate-900">{xpRecord.total} XP</p>
                  </div>
                </div>
                {/* Streak */}
                {xpRecord.streak > 0 && (
                  <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2">
                    <span className="text-xl">🔥</span>
                    <p className="text-sm font-bold text-amber-700">{xpRecord.streak}-day streak</p>
                  </div>
                )}
                {/* Placement level */}
                {placementLevel && (
                  <div className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-center">
                    <p className="text-xs font-medium text-sky-600">Placement level</p>
                    <p className="text-sm font-bold text-slate-900">{placementLevel}</p>
                  </div>
                )}
              </div>
              {/* XP bar */}
              {nextTier && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>{tier.name}</span>
                    <span className="font-medium">{xpProgress.xpInTier} / {xpProgress.tierSize} XP → {nextTier.name} {nextTier.icon}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pink-500 to-sky-500 transition-all duration-500"
                      style={{ width: `${xpProgress.pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {/* Learning goal – full width */}
            <label className="md:col-span-2 rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-600">
                Learning goal
              </span>
              <input
                className="mt-3 w-full rounded-xl border border-pink-100 bg-white/80 p-3 text-slate-900 outline-none focus:ring-2 focus:ring-pink-400"
                placeholder="Example: I want to get better at NumPy for a class"
                value={profile.goal}
                onChange={(e) => setProfile({ ...profile, goal: e.target.value })}
              />
            </label>

            {/* Skill level */}
            <label className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Skill level
              </span>
              <select
                className="mt-3 w-full rounded-xl border border-sky-100 bg-white/80 p-3 text-slate-900 outline-none focus:ring-2 focus:ring-sky-400"
                value={profile.skillLevel}
                onChange={(e) => setProfile({ ...profile, skillLevel: e.target.value })}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </label>

            {/* Motivation style */}
            <label className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-600">
                Motivation
              </span>
              <select
                className="mt-3 w-full rounded-xl border border-pink-100 bg-white/80 p-3 text-slate-900 outline-none focus:ring-2 focus:ring-pink-400"
                value={profile.motivation}
                onChange={(e) => setProfile({ ...profile, motivation: e.target.value })}
              >
                <option>Casual learning</option>
                <option>Competitive challenges</option>
                <option>Fast-paced practice</option>
              </select>
            </label>

            {/* Account info */}
            <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-600">
                Account
              </p>
              <p className="mt-3 text-sm text-slate-700">{user.email}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Placement quiz
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {placementDone
                  ? "You've completed placement. Retake it anytime to refresh your level and focus topics."
                  : "Take the placement quiz to unlock your personalized NumPy path."}
              </p>
            </div>
            <Link
              href="/find-my-level"
              className="shrink-0 rounded-xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
            >
              {placementDone ? "Retake quiz" : "Take placement quiz"}
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={handleSaveProfile}
              className="rounded-2xl bg-gradient-to-r from-pink-500 to-sky-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              {placementDone ? "Save profile" : "Save & take placement quiz →"}
            </button>

            <button
              onClick={handleLogout}
              className="rounded-2xl border border-slate-300 bg-white/70 px-6 py-3 font-semibold text-slate-700 transition hover:bg-white"
            >
              Log out
            </button>
          </div>

        </div>
      </section>
    </main>
  );
}
