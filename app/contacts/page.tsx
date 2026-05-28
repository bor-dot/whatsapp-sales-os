import Link from "next/link";
import { redirect } from "next/navigation";
import { ModuleNav } from "@/components/ModuleNav";
import { normalizePhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

type CustomerContact = {
  id: string;
  full_name: string;
  phone: string;
  whatsapp_phone: string | null;
  source: string | null;
  service_interest: string | null;
  status: string;
  next_follow_up_at: string | null;
};

function statusText(status: string) {
  switch (status) {
    case "new":
      return "Yeni";
    case "contacted":
      return "Görüşüldü";
    case "quoted":
      return "Teklif";
    case "waiting":
      return "Bekliyor";
    case "appointment":
      return "Randevu";
    case "won":
      return "Kazanıldı";
    case "lost":
      return "Kaybedildi";
    default:
      return status;
  }
}

export default async function ContactsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("customers")
    .select(
      "id, full_name, phone, whatsapp_phone, source, service_interest, status, next_follow_up_at",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  const contacts = (data ?? []) as CustomerContact[];
  const contactsWithPhone = contacts.map((contact) => ({
    ...contact,
    normalizedPhone: normalizePhone(contact.whatsapp_phone || contact.phone),
  }));
  const duplicatePhones = Array.from(
    contactsWithPhone.reduce((map, contact) => {
      if (!contact.normalizedPhone) return map;
      map.set(contact.normalizedPhone, (map.get(contact.normalizedPhone) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).filter(([, count]) => count > 1);
  const missingWhatsappCount = contacts.filter((contact) => !contact.whatsapp_phone).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ModuleNav />

        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-zinc-400">Contacts</p>
          <h1 className="mt-2 text-3xl font-semibold">Telefon bazlı müşteri eşleme</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            WhatsApp numarası veya telefon alanı normalize edilerek aynı müşteriyi
            yakalamak için kullanılır.
          </p>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Toplam contact</p>
            <p className="mt-3 text-3xl font-semibold">{contacts.length}</p>
          </div>
          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-200/80">WhatsApp numarası eksik</p>
            <p className="mt-3 text-3xl font-semibold text-amber-100">
              {missingWhatsappCount}
            </p>
          </div>
          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5">
            <p className="text-sm text-rose-200/80">Çakışan telefon</p>
            <p className="mt-3 text-3xl font-semibold text-rose-100">
              {duplicatePhones.length}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Contacts</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Webhook gelen numarayı bu normalize edilmiş değerle eşler.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm text-zinc-400">
                  <th className="px-4 py-2">Ad Soyad</th>
                  <th className="px-4 py-2">Telefon</th>
                  <th className="px-4 py-2">Normalize</th>
                  <th className="px-4 py-2">Kaynak</th>
                  <th className="px-4 py-2">İlgi</th>
                  <th className="px-4 py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {contactsWithPhone.length > 0 ? (
                  contactsWithPhone.map((contact) => (
                    <tr key={contact.id} className="bg-zinc-900/80 text-sm">
                      <td className="rounded-l-2xl px-4 py-3">
                        <Link
                          href={`/customers/${contact.id}`}
                          className="font-medium text-pink-300 hover:text-pink-200 hover:underline"
                        >
                          {contact.full_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{contact.whatsapp_phone || contact.phone}</td>
                      <td className="px-4 py-3">{contact.normalizedPhone || "-"}</td>
                      <td className="px-4 py-3">{contact.source ?? "-"}</td>
                      <td className="px-4 py-3">{contact.service_interest ?? "-"}</td>
                      <td className="rounded-r-2xl px-4 py-3">
                        {statusText(contact.status)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">
                      Henüz contact yok. Yeni müşteri eklediğinde burada görünür.
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
