import { redirect } from "next/navigation";
import Link from "next/link";
import { ModuleNav } from "@/components/ModuleNav";
import { OrganizationRequired } from "@/components/OrganizationSwitcher";
import { getOrganizationContext } from "@/lib/organizations";

const modules = [
  {
    name: "Contacts",
    status: "Aktif",
    detail: "Telefon numarası bazlı eşleme mevcut customers tablosu üzerinden çalışıyor.",
    href: "/contacts",
  },
  {
    name: "Conversations",
    status: "SQL gerekli",
    detail: "WhatsApp konuşmaları için whatsapp_messages tablosu ve webhook worker hazır.",
    href: "/conversations",
  },
  {
    name: "Appointments",
    status: "SQL gerekli",
    detail: "Randevu tablosu, otomatik reminder/teyit worker ve send queue bağlantısı hazır.",
    href: "/appointments",
  },
  {
    name: "Templates",
    status: "Hazır",
    detail: "Onay, hatırlatma, kampanya ve işlem sonrası mesaj şablonları eklendi.",
    href: "/templates",
  },
  {
    name: "Webhook Worker",
    status: "Hazır",
    detail: "GET doğrulama ve POST mesaj yazma endpoint'i /api/whatsapp/webhook altında.",
    href: "/conversations",
  },
  {
    name: "Send Queue",
    status: "SQL + env gerekli",
    detail: "CRM çıkış mesaj kuyruğu ve gönderim worker endpoint'i hazır.",
    href: "/send-queue",
  },
];

export default async function ModulesPage() {
  const { user, currentOrganization, currentOrganizationId } =
    await getOrganizationContext();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ModuleNav currentPath="/modules" />

        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-zinc-400">WhatsApp Sales OS</p>
          <h1 className="mt-2 text-3xl font-semibold">CRM modül durumu</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {currentOrganization
              ? `${currentOrganization.name} için temas, konuşma, randevu, şablon, webhook ve mesaj kuyruğu katmanları.`
              : "WhatsApp satış işletim sistemi için organization seçimi gerekiyor."}
          </p>
        </header>

        {!currentOrganizationId ? <OrganizationRequired /> : null}

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-semibold">{item.name}</h2>
                <span className="rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 text-xs font-medium text-pink-100">
                  {item.status}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-400">{item.detail}</p>
            </Link>
          ))}
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Kurulum notu</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Eksik Supabase tabloları için <span className="text-zinc-200">supabase/whatsapp_modules.sql</span>{" "}
            dosyası eklendi. WhatsApp token, phone number id ve verify token artık
            organization bazlı WhatsApp Connection kaydından okunur; Vercel’de sadece
            sistem-level worker secret tutulur.
          </p>
        </section>
      </div>
    </main>
  );
}
