import { redirect } from "next/navigation";
import { ModuleNav, SetupNotice } from "@/components/ModuleNav";
import { OrganizationRequired } from "@/components/OrganizationSwitcher";
import { getOrganizationContext } from "@/lib/organizations";
import { metaProviderText, type MetaConnection, type MetaProvider } from "@/lib/meta/connection";
import { isMissingTableError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { saveMetaConnection } from "./actions";

type MetaConnectionsPageProps = {
  searchParams: Promise<{
    saved?: string;
  }>;
};

const providers: Array<{
  provider: MetaProvider;
  title: string;
  description: string;
}> = [
  {
    provider: "facebook",
    title: "Facebook Lead Reklamları",
    description:
      "Facebook form kayıtlarını merkezin CRM müşteri listesine otomatik düşürür.",
  },
  {
    provider: "instagram",
    title: "Instagram Lead Reklamları",
    description:
      "Instagram üzerinden gelen form kayıtlarını aynı merkez sınırı içinde işler.",
  },
];

function connectionFor(
  connections: MetaConnection[],
  provider: MetaProvider,
) {
  return connections.find((connection) => connection.provider === provider) ?? null;
}

export default async function MetaConnectionsPage({
  searchParams,
}: MetaConnectionsPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { user, currentOrganization, currentOrganizationId } =
    await getOrganizationContext();

  if (!user) {
    redirect("/login");
  }

  if (!currentOrganizationId || !currentOrganization) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <ModuleNav currentPath="/meta-connections" />
          <OrganizationRequired />
        </div>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("meta_connections")
    .select(
      "organization_id, provider, display_name, page_id, instagram_business_account_id, ad_account_id, verify_token, access_token_encrypted, is_connected",
    )
    .eq("organization_id", currentOrganizationId);
  const setupRequired = isMissingTableError(error);

  if (error && !setupRequired) {
    throw new Error(error.message);
  }

  const connections = setupRequired ? [] : ((data ?? []) as MetaConnection[]);
  const callbackUrl = "/api/meta/webhook";

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <ModuleNav currentPath="/meta-connections" />

        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-zinc-400">Facebook / Instagram</p>
          <h1 className="mt-2 text-3xl font-semibold">Meta form entegrasyonu</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {currentOrganization.name} için Facebook ve Instagram form kayıtlarını
            merkez bazlı webhook ile CRM’e aktar.
          </p>
        </header>

        {setupRequired ? (
          <SetupNotice>
            <strong>Meta entegrasyon tabloları eksik.</strong>{" "}
            <span className="text-white">supabase/whatsapp_modules.sql</span> dosyasındaki
            Meta bölümünü Supabase SQL editöründe çalıştır.
          </SetupNotice>
        ) : null}

        {params.saved ? (
          <div className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-sm text-emerald-100">
            {metaProviderText(params.saved)} bağlantısı kaydedildi.
          </div>
        ) : null}

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Webhook kurulumu</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Meta uygulamasında callback yolu olarak{" "}
            <span className="text-zinc-100">{callbackUrl}</span> kullan. Doğrulama
            token’ı her merkez ve kanal için aşağıdaki formda saklanır.
          </p>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          {providers.map((item) => {
            const connection = connectionFor(connections, item.provider);

            return (
              <form
                key={item.provider}
                action={saveMetaConnection}
                className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-6"
              >
                <input type="hidden" name="provider" value={item.provider} />
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-400">{metaProviderText(item.provider)}</p>
                      <h2 className="mt-1 text-2xl font-semibold">{item.title}</h2>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                      {connection?.is_connected ? "Bağlı" : "Pasif"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    {item.description}
                  </p>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <label htmlFor={`${item.provider}_display_name`} className="text-sm text-zinc-300">
                      Bağlantı adı
                    </label>
                    <input
                      id={`${item.provider}_display_name`}
                      name="display_name"
                      defaultValue={connection?.display_name ?? ""}
                      placeholder="Örn: Merkez Instagram hesabı"
                      className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor={`${item.provider}_page_id`} className="text-sm text-zinc-300">
                      Facebook Sayfa ID
                    </label>
                    <input
                      id={`${item.provider}_page_id`}
                      name="page_id"
                      defaultValue={connection?.page_id ?? ""}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor={`${item.provider}_instagram_business_account_id`}
                      className="text-sm text-zinc-300"
                    >
                      Instagram işletme hesabı ID
                    </label>
                    <input
                      id={`${item.provider}_instagram_business_account_id`}
                      name="instagram_business_account_id"
                      defaultValue={connection?.instagram_business_account_id ?? ""}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor={`${item.provider}_ad_account_id`} className="text-sm text-zinc-300">
                      Reklam hesabı ID
                    </label>
                    <input
                      id={`${item.provider}_ad_account_id`}
                      name="ad_account_id"
                      defaultValue={connection?.ad_account_id ?? ""}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor={`${item.provider}_verify_token`} className="text-sm text-zinc-300">
                      Doğrulama token’ı
                    </label>
                    <input
                      id={`${item.provider}_verify_token`}
                      name="verify_token"
                      defaultValue={connection?.verify_token ?? ""}
                      className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor={`${item.provider}_access_token`} className="text-sm text-zinc-300">
                      Erişim token’ı
                    </label>
                    <input
                      id={`${item.provider}_access_token`}
                      name="access_token"
                      type="password"
                      placeholder={
                        connection?.access_token_encrypted
                          ? "Kayıtlı token var. Değiştirmek için yeni token gir."
                          : "Meta Graph API token’ı"
                      }
                      className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    name="is_connected"
                    defaultChecked={connection?.is_connected ?? false}
                    className="h-4 w-4 accent-pink-500"
                  />
                  Bağlantı aktif
                </label>

                <button
                  type="submit"
                  className="rounded-2xl bg-pink-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-pink-400"
                >
                  Kaydet
                </button>
              </form>
            );
          })}
        </section>
      </div>
    </main>
  );
}
