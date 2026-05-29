import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { changeFirstLoginPassword } from "@/app/first-login/change-password/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "İlk Girişte Şifre Değiştir",
};

type FirstLoginChangePasswordPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function FirstLoginChangePasswordPage({
  searchParams,
}: FirstLoginChangePasswordPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile && !profile.must_change_password) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-12">
        <section className="w-full rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur sm:p-8">
          <p className="text-sm text-zinc-400">İlk giriş</p>
          <h1 className="mt-1 text-3xl font-semibold">Şifreni Değiştir</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Güvenlik için geçici şifreyle devam edemezsin. Yeni şifreni belirledikten
            sonra CRM panelin açılır.
          </p>

          {params.error ? (
            <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {params.error}
            </div>
          ) : null}

          <form action={changeFirstLoginPassword} className="mt-6 space-y-4">
            <label className="space-y-2 text-sm text-zinc-300">
              <span>Geçici şifre</span>
              <input
                name="current_password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-pink-400/40"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
              <span>Yeni şifre</span>
              <input
                name="new_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-pink-400/40"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-300">
              <span>Yeni şifre tekrar</span>
              <input
                name="confirm_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-pink-400/40"
              />
            </label>
            <button className="w-full rounded-2xl bg-pink-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-pink-400">
              Şifreyi Güncelle
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
