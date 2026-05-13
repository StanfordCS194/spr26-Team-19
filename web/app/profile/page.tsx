"use client";
 
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
 
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
 
  useEffect(() => {
    const savedUser = localStorage.getItem("adaptedCurrentUser");
 
    if (!savedUser) {
      // Not logged in – send back to auth
      router.push("/");
      return;
    }
 
    setUser(JSON.parse(savedUser));
 
    // Pre-fill form if they've saved a profile before
    const savedProfile = localStorage.getItem("adaptedProfile");
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }
  }, [router]);
 
  function handleSaveProfile() {
    localStorage.setItem("adaptedProfile", JSON.stringify(profile));
    router.push("/dashboard");
  }
 
  function handleLogout() {
    localStorage.removeItem("adaptedCurrentUser");
    localStorage.removeItem("adaptedProfile");
    router.push("/");
  }
 
  if (!user) return null;
 
  return (
    <main className="relative min-h-screen overflow-hidden p-6 md:p-10">
      {/* Soft ambient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-pink-200/40 blur-3xl" />
        <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-purple-200/30 blur-3xl" />
      </div>
 
      <section className="relative mx-auto flex min-h-[85vh] w-full max-w-5xl items-center justify-center">
        <div className="w-full rounded-3xl border border-white/70 bg-white/65 p-8 shadow-xl backdrop-blur md:p-12">
 
          <Link
            href="/dashboard"
            className="text-sm font-medium text-sky-700 hover:underline"
          >
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
 
          <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            Build your AdaptED profile
          </h1>
 
          <p className="mt-4 max-w-2xl text-lg text-slate-700">
            Hi {user.name}, tell us how you want to learn so we can shape your AdaptED journey!
          </p>
 
          <div className="mt-10 grid gap-5 md:grid-cols-2">
 
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
 
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={handleSaveProfile}
              className="rounded-2xl bg-gradient-to-r from-pink-500 to-sky-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              Save profile
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
