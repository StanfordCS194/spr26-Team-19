export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-900">
          How do you want to begin?
        </h1>
        <p className="mt-2 text-gray-600">
          Choose a path based on your NumPy experience.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <a
            href="/start-from-scratch"
            className="block rounded-md border-2 border-gray-300 p-5 transition hover:bg-gray-100"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              Start from scratch
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Begin with foundations like arrays, indexing, and shapes.
            </p>
          </a>

          <a
            href="/find-my-level"
            className="block rounded-md border-2 border-gray-300 p-5 transition hover:bg-gray-100"
          >
            <h2 className="text-lg font-semibold text-gray-900">
              Find my level
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Take a quick diagnostic on NumPy topics and difficulty.
            </p>
          </a>
        </div>
      </div>
    </main>
  );
}