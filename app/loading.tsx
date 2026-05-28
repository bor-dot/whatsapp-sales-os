export default function Loading() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="space-y-3">
            <div className="h-4 w-36 rounded-full bg-white/10" />
            <div className="h-8 w-72 rounded-full bg-white/10" />
          </div>
          <div className="h-11 w-32 rounded-2xl bg-white/10" />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-28 rounded-3xl border border-white/10 bg-white/5"
            />
          ))}
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-5 h-6 w-44 rounded-full bg-white/10" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 rounded-2xl bg-zinc-900/80" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
