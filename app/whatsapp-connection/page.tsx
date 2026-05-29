import { redirect } from "next/navigation";
import { ModuleNav, SetupNotice } from "@/components/ModuleNav";
import { OrganizationRequired } from "@/components/OrganizationSwitcher";
import { getOrganizationContext } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";
import { saveWhatsappConnection } from "./actions";

type WhatsappConnectionPageProps = {
  searchParams: Promise<{
    saved?: string;
  }>;
};

type WhatsappConnection = {
  display_phone_number: string | null;
  phone_number_id: string | null;
  business_account_id: string | null;
  verify_token: string | null;
  access_token_encrypted: string | null;
  is_connected: boolean;
};

export default async function WhatsappConnectionPage({
  searchParams,
}: WhatsappConnectionPageProps) {
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
        <div className="mx-auto max-w-5xl px-6 py-8">
          <ModuleNav currentPath="/whatsapp-connection" />
          <OrganizationRequired />
        </div>
      </main>
    );
  }

  const { data } = await supabase
    .from("whatsapp_connections")
    .select(
      "display_phone_number, phone_number_id, business_account_id, verify_token, access_token_encrypted, is_connected",
    )
    .eq("organization_id", currentOrganizationId)
    .maybeSingle();
  const connection = data as WhatsappConnection | null;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <ModuleNav currentPath="/whatsapp-connection" />

        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-zinc-400">WhatsApp Bağlantısı</p>
          <h1 className="mt-2 text-3xl font-semibold">
            {currentOrganization.name} bağlantısı
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Bu bilgiler yalnızca aktif merkez için kullanılır. Farklı merkezlerin
            token ve telefon numarası ID değerleri birbirine karışmaz.
          </p>
        </header>

        {params.saved ? (
          <div className="mb-6 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-sm text-emerald-100">
            WhatsApp bağlantısı kaydedildi.
          </div>
        ) : null}

        {!connection ? (
          <SetupNotice>
            Bu merkez için henüz WhatsApp bağlantısı yok. Webhook ve mesaj kuyruğu
            gerçek gönderime geçmeden önce aşağıdaki bilgileri kaydet.
          </SetupNotice>
        ) : null}

        <form
          action={saveWhatsappConnection}
          className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="display_phone_number" className="text-sm text-zinc-300">
                Görünen Telefon Numarası
              </label>
              <input
                id="display_phone_number"
                name="display_phone_number"
                defaultValue={connection?.display_phone_number ?? ""}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone_number_id" className="text-sm text-zinc-300">
                Telefon Numarası ID
              </label>
              <input
                id="phone_number_id"
                name="phone_number_id"
                defaultValue={connection?.phone_number_id ?? ""}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="business_account_id" className="text-sm text-zinc-300">
                İşletme Hesabı ID
              </label>
              <input
                id="business_account_id"
                name="business_account_id"
                defaultValue={connection?.business_account_id ?? ""}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="verify_token" className="text-sm text-zinc-300">
                Doğrulama Token’ı
              </label>
              <input
                id="verify_token"
                name="verify_token"
                defaultValue={connection?.verify_token ?? ""}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="access_token" className="text-sm text-zinc-300">
                Erişim Token’ı
              </label>
              <input
                id="access_token"
                name="access_token"
                type="password"
                placeholder={
                  connection?.access_token_encrypted
                    ? "Kayıtlı token var. Değiştirmek için yeni token gir."
                    : "Meta WhatsApp Cloud API token’ı"
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
      </div>
    </main>
  );
}
