import { setActiveOrganization } from "@/app/auth/actions";
import type { OrganizationSummary } from "@/lib/organizations";

type OrganizationSwitcherProps = {
  organizations: OrganizationSummary[];
  currentOrganizationId: string | null;
  currentPath?: string;
};

export function OrganizationSwitcher({
  organizations,
  currentOrganizationId,
  currentPath = "/",
}: OrganizationSwitcherProps) {
  if (organizations.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Merkez üyeliği bulunamadı.
      </div>
    );
  }

  if (organizations.length === 1) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-200">
        Aktif merkez: {organizations[0].name}
      </div>
    );
  }

  return (
    <form action={setActiveOrganization} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="redirect_to" value={currentPath} />
      <label htmlFor="organization_id" className="sr-only">
        Merkez
      </label>
      <select
        id="organization_id"
        name="organization_id"
        defaultValue={currentOrganizationId ?? ""}
        className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
      >
        <option value="" disabled>
          Merkez seç
        </option>
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-2xl bg-pink-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-pink-400"
      >
        Geç
      </button>
    </form>
  );
}

export function OrganizationRequired() {
  return (
    <section className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-6 text-sm leading-6 text-amber-100">
      Bu kullanıcı için aktif merkez seçilmedi. Devam etmek için üstteki merkez
      seçiciden bir merkez seç.
    </section>
  );
}
