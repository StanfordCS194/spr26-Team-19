import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden p-6 md:p-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-pink-200/40 blur-3xl" />
        <div className="absolute -right-20 top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-purple-200/30 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-[85vh] w-full max-w-5xl items-center justify-center">
        <div className="w-full rounded-3xl border border-white/70 bg-white/65 p-8 shadow-xl backdrop-blur md:p-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-medium text-pink-700">
              Personalized learning
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
              NumPy foundations
            </span>
          </div>

          <h1 className="mt-5 text-5xl font-black tracking-tight text-slate-900 md:text-6xl">
            AdaptED
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-700">
            Learn smarter with an adaptive study experience: start from first
            principles or jump into a level check and get a path that fits you.
          </p>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Link
              href="/start-from-scratch"
              className="group rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pink-600">
                Beginner path
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Start from scratch
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