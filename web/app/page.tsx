"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type User = {
  name: string;
  email: string;
  password: string;
  createdAt: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Redirect already logged in users to the dashboard directly
  useEffect(() => {
    const currentUser = localStorage.getItem("adaptedCurrentUser");
    if (currentUser) {
      router.push("/dashboard");
    }
  }, [router]);

  //Reads adaptedUsers from localStorage
  function getUsers(): User[] {
    const saved = localStorage.getItem("adaptedUsers");
    return saved ? JSON.parse(saved) : [];
  }

  //If email already registered, asks user to llogin instead
  function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) return;

    const users = getUsers();
    const alreadyExists = users.find((u) => u.email === email);
    if (alreadyExists) {
      alert("An account with this email already exists. Please log in!");
      setMode("login");
      return;
    }

    const newUser: User = {
      name,
      email,
      password,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("adaptedUsers", JSON.stringify([...users, newUser]));
    localStorage.setItem("adaptedCurrentUser", JSON.stringify(newUser));

    // New users go to /profile to fill out their learner profile first
    router.push("/profile");
  }

  function handleLogin() {
    if (!email.trim() || !password.trim()) return;

    const users = getUsers();
    const user = users.find(
      (u) => u.email === email && u.password === password
    );

    if (!user) {
      alert("No account found with that email and password.");
      return;
    }

    localStorage.setItem("adaptedCurrentUser", JSON.stringify(user));
    router.push("/dashboard");
  }

  const canSubmit =
    mode === "login"
      ? email.trim() && password.trim()
      : name.trim() && email.trim() && password.trim();

  return (
    <main className="relative min-h-screen overflow-hidden p-6 md:p-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-pink-200/40 blur-3xl" />
        <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-purple-200/30 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-[85vh] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full gap-6 rounded-3xl border border-white/70 bg-white/65 p-8 shadow-xl backdrop-blur md:grid-cols-[1.1fr_0.9fr] md:p-12">

          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-medium text-pink-700">
                Personalized learning
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                Adaptive practice
              </span>
            </div>

            <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-900 md:text-6xl">
              AdaptED
            </h1>

            <p className="mt-4 max-w-2xl text-lg text-slate-700">
              Build a learner profile, choose your pace, and get a NumPy path
              shaped around your strengths and weak spots.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-600">
                  Learn
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Start from fundamentals with visuals and guided examples.
                </p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                  Adapt
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Take diagnostics and get a route based on your level.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/75 p-6 shadow-lg backdrop-blur">
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {mode === "login"
                ? "Log in to continue your learning path."
                : "Register to create your personalized AdaptED profile."}
            </p>

            <div className="mt-6 flex overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button
                className={`w-1/2 p-3 text-sm font-semibold transition ${
                  mode === "login"
                    ? "bg-gradient-to-r from-pink-500 to-sky-500 text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setMode("login")}
              >
                Log in
              </button>
              <button
                className={`w-1/2 p-3 text-sm font-semibold transition ${
                  mode === "register"
                    ? "bg-gradient-to-r from-pink-500 to-sky-500 text-white"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
                onClick={() => setMode("register")}
              >
                Register
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              {mode === "register" && (
                <input
                  className="rounded-xl border border-pink-100 bg-white/80 p-3 text-slate-900 outline-none focus:ring-2 focus:ring-pink-400"
                  placeholder="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              )}

              <input
                className="rounded-xl border border-sky-100 bg-white/80 p-3 text-slate-900 outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                className="rounded-xl border border-pink-100 bg-white/80 p-3 text-slate-900 outline-none focus:ring-2 focus:ring-pink-400"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                onClick={mode === "login" ? handleLogin : handleRegister}
                className="mt-2 rounded-2xl bg-gradient-to-r from-pink-500 to-sky-500 px-6 py-3 font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
                disabled={!canSubmit}
              >
                {mode === "login" ? "Log in" : "Register"}
              </button>
            </div>
          </div>

          <p className="mt-8 text-center text-sm text-slate-600">
            After placement, open your{" "}
            <Link href="/numpy/path" className="font-medium text-sky-700 hover:underline">
              NumPy learning path
            </Link>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
