"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState<"signin" | "signup" | null>(null);

  async function handleSignIn() {
    setMessage("");
    setLoading("signin");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  async function handleSignUp() {
    setMessage("");
    setLoading("signup");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.session) {
      router.replace("/");
      router.refresh();
      return;
    }

    setMessage("Kayıt oluşturuldu. Şimdi giriş yap.");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur md:grid-cols-2">
          <section className="hidden bg-gradient-to-br from-pink-500/20 via-fuchsia-500/10 to-zinc-900 p-10 md:flex md:flex-col md:justify-between">
            <div>
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-pink-300">
                WhatsApp Sales OS
              </p>
              <h1 className="text-4xl font-semibold leading-tight">
                Güzellik merkezi satış ve takip paneli
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-zinc-300">
                WhatsApp’tan gelen müşteriyi kaçırmamak için müşteriyi, teklifi ve takip tarihini tek yerde topla.
              </p>
            </div>

            <ul className="space-y-3 text-sm text-zinc-300">
              <li>• Yeni lead kaydı</li>
              <li>• Teklif ve fiyat notu</li>
              <li>• Sonraki takip tarihi</li>
              <li>• Bugün aranacak müşteri görünümü</li>
            </ul>
          </section>

          <section className="p-6 sm:p-8 md:p-10">
            <div className="mx-auto max-w-md">
              <h2 className="text-2xl font-semibold">Giriş yap</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Devam etmek için hesabına giriş yap ya da yeni hesap oluştur.
              </p>

              {message ? (
                <div className="mt-4 rounded-2xl border border-pink-400/30 bg-pink-500/10 px-4 py-3 text-sm text-pink-100">
                  {message}
                </div>
              ) : null}

              <div className="mt-8 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm text-zinc-300">
                    E-posta
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="text"
                    inputMode="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder="ornek@mail.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm text-zinc-300">
                    Şifre
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                  />
                </div>

                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={loading !== null}
                    className="rounded-2xl bg-pink-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading === "signin" ? "Giriş yapılıyor..." : "Giriş Yap"}
                  </button>

                  <button
                    type="button"
                    onClick={handleSignUp}
                    disabled={loading !== null}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading === "signup" ? "Kayıt oluşturuluyor..." : "Kayıt Ol"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
