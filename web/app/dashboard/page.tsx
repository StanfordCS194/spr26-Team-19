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

  useEffect(() => {
    const savedUser = localStorage.getItem("adaptedCurrentUser");
    if (!savedUser) {
      router.push("/");
      return;
    }
    setUser(JSON.parse(savedUser));

    const savedProfile = localStorage.getItem("adaptedProfile");
    if (savedProfile) setProfile(JSON.parse(savedProfile));
  }, [router]);

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

      <section className="relative mx-auto flex min-h-[85vh] w-full max-w-5xl flex-col justify-center">
        <div className="w-full rounded-3xl border border-white/70 bg-white/65 p-8 shadow-xl backdrop-blur md:p-12">

          {/* Header row */}
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
          <p className="mt-4 max-w-2xl text-lg text-slate-700">
            {profile?.goal
              ? `Goal: ${profile.goal}`
              : "Welcome to AdaptED!"}
          </p>

          {/* Profile summary pill */}
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

          {/* Learning path cards */}
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Link
              href="/numpy/lessons"
              className="group rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-600">
                Beginner path
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Lessons
              </h2>
              <p className="mt-2 text-slate-700">
                Build intuition with interactive visuals, guided practice, and
                core NumPy concepts.
              </p>
              <p className="mt-4 text-sm font-semibold text-pink-700 transition group-hover:translate-x-1">
                Enter foundations →
              </p>
            </Link>

            <Link
              href="/find-my-level"
              className="group rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Adaptive path
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Find my level
              </h2>
              <p className="mt-2 text-slate-700">
                Take a quick diagnostic and get a recommended starting level in
                minutes.
              </p>
              <p className="mt-4 text-sm font-semibold text-sky-700 transition group-hover:translate-x-1">
                Start diagnostic →
              </p>
            </Link>
          </div>

        </div>
      </section>
    </main>
  );
}
