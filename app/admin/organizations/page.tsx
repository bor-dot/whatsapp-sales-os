import Link from "next/link";
import type { Metadata } from "next";
import { signOut } from "@/app/auth/actions";
import { requireSuperAdmin } from "@/lib/admin-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Admin Organizasyonlar",
};

type AdminOrganizationsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type MemberRow = {
  organization_id: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${
        active
          ? "border-emerald-400/20 bg-emerald-500/15 text-emerald-200"
          : "border-rose-400/20 bg-rose-500/15 text-rose-200"
      }`}
    >
      {active ? "Aktif" : "Pasif"}
    </span>
  );
}

function MessageBanner({ error, success }: { error?: string; success?: string }) {
  const message = error ?? success;

  if (!message) return null;

  return (
    <div
      className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
        error
          ? "border-rose-400/30 bg-rose-500/10 text-rose-100"
          : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      }`}
    >
      {message}
    </div>
  );
}

export default async function AdminOrganizationsPage({
  searchParams,
}: AdminOrganizationsPageProps) {
  const params = await searchParams;
  const { user } = await requireSuperAdmin();
  const supabaseAdmin = createAdminClient();

  if (!supabaseAdmin) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <MessageBanner error="SUPABASE_SERVICE_ROLE_KEY eksik. Admin kullanıcı oluşturma için Vercel env’e eklenmeli." />
        </div>
      </main>
    );
  }

  const [{ data: organizations }, { data: members }] = await Promise.all([
    supabaseAdmin
      .from("organizations")
      .select("id, name, slug, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("organization_members").select("organization_id"),
  ]);
  const memberCounts = ((members ?? []) as MemberRow[]).reduce<Record<string, number>>(
    (counts, member) => {
      counts[member.organization_id] = (counts[member.organization_id] ?? 0) + 1;
      return counts;
    },
    {},
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-400">Super admin</p>
            <h1 className="mt-1 text-3xl font-semibold">Güzellik Merkezleri</h1>
            <p className="mt-2 text-sm text-zinc-400">{user.email}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10"
            >
              CRM Paneli
            </Link>
            <Link
              href="/admin/organizations/new"
              className="rounded-2xl bg-pink-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-pink-400"
            >
              Güzellik Merkezi Ekle
            </Link>
            <form action={signOut}>
              <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10">
                Çıkış Yap
              </button>
            </form>
          </div>
        </header>

        <MessageBanner error={params.error} success={params.success} />

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Organizasyon Listesi</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Merkez oluştur, yetkili kullanıcı ata ve aktiflik durumunu yönet.
              </p>
            </div>
            <p className="text-sm text-zinc-400">
              Toplam {organizations?.length ?? 0} merkez
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm text-zinc-400">
                  <th className="px-4 py-2">Merkez</th>
                  <th className="px-4 py-2">Slug</th>
                  <th className="px-4 py-2">Durum</th>
                  <th className="px-4 py-2">Kullanıcı</th>
                  <th className="px-4 py-2">Oluşturma</th>
                  <th className="px-4 py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {organizations && organizations.length > 0 ? (
                  (organizations as OrganizationRow[]).map((organization) => (
                    <tr key={organization.id} className="bg-zinc-900/80 text-sm">
                      <td className="rounded-l-2xl px-4 py-3 font-medium">
                        {organization.name}
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {organization.slug ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={organization.is_active ?? true} />
                      </td>
                      <td className="px-4 py-3">
                        {memberCounts[organization.id] ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        {formatDate(organization.created_at)}
                      </td>
                      <td className="rounded-r-2xl px-4 py-3">
                        <Link
                          href={`/admin/organizations/${organization.id}`}
                          className="text-pink-300 hover:text-pink-200 hover:underline"
                        >
                          Yönet
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">
                      Henüz güzellik merkezi yok. İlk merkezi ekleyerek başlayın.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
