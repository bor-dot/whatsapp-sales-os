import Link from "next/link";
import type { Metadata } from "next";
import { createOrganizationWithOwner } from "@/app/admin/organizations/actions";
import { generateTemporaryPassword } from "@/lib/admin-onboarding";
import { requireSuperAdmin } from "@/lib/admin-guards";

export const metadata: Metadata = {
  title: "Yeni Güzellik Merkezi",
};

type NewOrganizationPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function MessageBanner({ error }: { error?: string }) {
  if (!error) return null;

  return (
    <div className="mb-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      {error}
    </div>
  );
}

export default async function NewOrganizationPage({
  searchParams,
}: NewOrganizationPageProps) {
  const params = await searchParams;
  await requireSuperAdmin();
  const temporaryPassword = generateTemporaryPassword();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-zinc-400">Admin</p>
          <h1 className="mt-1 text-3xl font-semibold">Güzellik Merkezi Ekle</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Yeni merkezi ve merkezin yetkili kullanıcısını tek adımda oluştur.
          </p>
        </header>

        <MessageBanner error={params.error} />

        <form
          action={createOrganizationWithOwner}
          className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <section>
            <h2 className="text-lg font-semibold">Merkez Bilgileri</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Merkez adı</span>
                <input
                  name="organization_name"
                  required
                  placeholder="Örnek Güzellik Merkezi"
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Slug</span>
                <input
                  name="slug"
                  placeholder="ornek-guzellik-merkezi"
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                />
              </label>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Yetkili Kullanıcı</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Ad soyad</span>
                <input
                  name="owner_name"
                  required
                  placeholder="Yetkili adı"
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>E-posta</span>
                <input
                  name="owner_email"
                  type="email"
                  required
                  placeholder="yetkili@mail.com"
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300 sm:col-span-2">
                <span>Geçici şifre</span>
                <input
                  name="temporary_password"
                  required
                  minLength={8}
                  defaultValue={temporaryPassword}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                />
              </label>
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              Kullanıcı ilk girişte bu şifreyi değiştirmeye zorlanır.
            </p>
          </section>

          <div className="flex flex-wrap gap-3 pt-2">
            <button className="rounded-2xl bg-pink-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-pink-400">
              Merkezi ve Yetkiliyi Oluştur
            </button>
            <Link
              href="/admin/organizations"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium hover:bg-white/10"
            >
              İptal
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
