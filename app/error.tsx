"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-10">
        <section className="w-full rounded-3xl border border-white/10 bg-white/5 p-8">
          <p className="text-sm text-zinc-400">WhatsApp Sales OS</p>
          <h1 className="mt-3 text-3xl font-semibold">Bir şey ters gitti</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Sayfa yüklenirken hata oluştu. Tekrar denediğinde mevcut veriler korunur.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-2xl bg-pink-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-pink-400"
          >
            Tekrar Dene
          </button>
        </section>
      </div>
    </main>
  );
}
