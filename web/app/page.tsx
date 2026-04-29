export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white/80 backdrop-blur rounded-2xl shadow-lg ring-1 ring-slate-200 p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          How do you want to begin?
        </h1>
        <p className="mt-2 text-slate-600">
          Choose a path based on your NumPy experience. You can switch any time.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <a
            href="/start-from-scratch"
            className="block rounded-xl border border-slate-200 bg-white/60 p-5 transition hover:bg-white hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Start from scratch
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Begin with foundations like arrays, indexing, and shapes.
            </p>
          </a>

          <a
            href="/find-my-level"
            className="block rounded-xl border border-slate-200 bg-white/60 p-5 transition hover:bg-white hover:border-slate-300 hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 focus-visible:ring-offset-2"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              Find my level
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Take a quick diagnostic on NumPy topics and difficulty.
            </p>
          </a>
        </div>
      </div>
    </main>
  );
}