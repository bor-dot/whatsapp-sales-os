import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  createOrganizationUser,
  updateOrganization,
  updateOrganizationMember,
} from "@/app/admin/organizations/actions";
import { generateTemporaryPassword } from "@/lib/admin-onboarding";
import { requireSuperAdmin } from "@/lib/admin-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Merkez Yönetimi",
};

type OrganizationDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
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
  user_id: string;
  organization_id: string;
  role: string | null;
  created_at: string | null;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
  must_change_password: boolean | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

export default async function OrganizationDetailPage({
  params,
  searchParams,
}: OrganizationDetailPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await requireSuperAdmin();
  const supabaseAdmin = createAdminClient();

  if (!supabaseAdmin) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <MessageBanner error="SUPABASE_SERVICE_ROLE_KEY eksik. Admin işlemleri için Vercel env’e eklenmeli." />
        </div>
      </main>
    );
  }

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select("id, name, slug, is_active, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!organization) {
    redirect("/admin/organizations?error=Merkez bulunamadı.");
  }

  const { data: members } = await supabaseAdmin
    .from("organization_members")
    .select("user_id, organization_id, role, created_at")
    .eq("organization_id", id)
    .order("created_at", { ascending: true });
  const memberRows = (members ?? []) as MemberRow[];
  const userIds = memberRows.map((member) => member.user_id);
  const { data: profiles } =
    userIds.length > 0
      ? await supabaseAdmin
          .from("user_profiles")
          .select("user_id, full_name, role, is_active, must_change_password")
          .in("user_id", userIds)
      : { data: [] };
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const profileByUserId = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
  );
  const authUserById = new Map(
    authUsers.users.map((authUser) => [authUser.id, authUser]),
  );
  const temporaryPassword = generateTemporaryPassword();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-400">Merkez yönetimi</p>
            <h1 className="mt-1 text-3xl font-semibold">
              {(organization as OrganizationRow).name}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Oluşturma: {formatDate((organization as OrganizationRow).created_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/organizations"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10"
            >
              Organizasyonlar
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10"
            >
              CRM Paneli
            </Link>
          </div>
        </header>

        <MessageBanner error={query.error} success={query.success} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Merkez Bilgileri</h2>
            <form action={updateOrganization} className="mt-4 grid gap-4 sm:grid-cols-2">
              <input
                type="hidden"
                name="organization_id"
                value={(organization as OrganizationRow).id}
              />
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Merkez adı</span>
                <input
                  name="organization_name"
                  required
                  defaultValue={(organization as OrganizationRow).name}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-pink-400/40"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Slug</span>
                <input
                  name="slug"
                  required
                  defaultValue={(organization as OrganizationRow).slug ?? ""}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-pink-400/40"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-zinc-200">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={(organization as OrganizationRow).is_active ?? true}
                  className="h-4 w-4 accent-pink-500"
                />
                Aktif merkez
              </label>
              <div className="flex items-center">
                <button className="rounded-2xl bg-pink-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-pink-400">
                  Merkezi Güncelle
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Yetkili Kullanıcı Ekle</h2>
            <form action={createOrganizationUser} className="mt-4 space-y-4">
              <input
                type="hidden"
                name="organization_id"
                value={(organization as OrganizationRow).id}
              />
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Ad soyad</span>
                <input
                  name="full_name"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-pink-400/40"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>E-posta</span>
                <input
                  name="email"
                  type="email"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-pink-400/40"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Geçici şifre</span>
                <input
                  name="temporary_password"
                  required
                  minLength={8}
                  defaultValue={temporaryPassword}
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 font-mono text-sm text-white outline-none focus:border-pink-400/40"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span>Rol</span>
                <select
                  name="member_role"
                  defaultValue="member"
                  className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-pink-400/40"
                >
                  <option value="owner">Owner</option>
                  <option value="member">Ekip üyesi</option>
                </select>
              </label>
              <button className="w-full rounded-2xl bg-pink-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-pink-400">
                Kullanıcı Oluştur
              </button>
            </form>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Merkez Kullanıcıları</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Kullanıcı durumunu ve organizasyon rolünü yönet.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm text-zinc-400">
                  <th className="px-4 py-2">Kullanıcı</th>
                  <th className="px-4 py-2">E-posta</th>
                  <th className="px-4 py-2">Durum</th>
                  <th className="px-4 py-2">İlk Giriş</th>
                  <th className="px-4 py-2">Üyelik</th>
                  <th className="px-4 py-2">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {memberRows.length > 0 ? (
                  memberRows.map((member) => {
                    const profile = profileByUserId.get(member.user_id);
                    const authUser = authUserById.get(member.user_id);
                    const fullName =
                      profile?.full_name ??
                      (typeof authUser?.user_metadata?.full_name === "string"
                        ? authUser.user_metadata.full_name
                        : "İsimsiz kullanıcı");
                    const isActive = profile?.is_active ?? true;

                    return (
                      <tr key={member.user_id} className="bg-zinc-900/80 text-sm">
                        <td className="rounded-l-2xl px-4 py-3 font-medium">
                          {fullName}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {authUser?.email ?? member.user_id}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge active={isActive} />
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {profile?.must_change_password ? "Şifre değişimi bekliyor" : "Tamamlandı"}
                        </td>
                        <td className="px-4 py-3 text-zinc-300">
                          {formatDate(member.created_at)}
                        </td>
                        <td className="rounded-r-2xl px-4 py-3">
                          <form action={updateOrganizationMember} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="organization_id" value={member.organization_id} />
                            <input type="hidden" name="user_id" value={member.user_id} />
                            <select
                              name="member_role"
                              defaultValue={member.role ?? "member"}
                              className="rounded-2xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-pink-400/40"
                            >
                              <option value="owner">Owner</option>
                              <option value="member">Ekip üyesi</option>
                            </select>
                            <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
                              <input
                                type="checkbox"
                                name="is_active"
                                defaultChecked={isActive}
                                className="h-4 w-4 accent-pink-500"
                              />
                              Aktif
                            </label>
                            <button className="rounded-2xl bg-pink-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-400">
                              Kaydet
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">
                      Bu merkeze bağlı kullanıcı yok.
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
