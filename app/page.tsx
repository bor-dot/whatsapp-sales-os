// file: app/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, full_name, phone, service_interest, status, next_follow_up_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  const totalCustomers = customers?.length ?? 0;
  const waitingCount = customers?.filter((item) => item.status === "waiting").length ?? 0;
  const quotedCount = customers?.filter((item) => item.status === "quoted").length ?? 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-400">WhatsApp Sales OS</p>
            <h1 className="mt-1 text-3xl font-semibold">Hoş geldin</h1>
            <p className="mt-2 text-sm text-zinc-400">{user.email}</p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/customers/new"
              className="rounded-2xl bg-pink-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-pink-400"
            >
              Yeni Müşteri
            </Link>

            <form action={signOut}>
              <button className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10">
                Çıkış Yap
              </button>
            </form>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Toplam müşteri</p>
            <p className="mt-3 text-3xl font-semibold">{totalCustomers}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Bekleyen</p>
            <p className="mt-3 text-3xl font-semibold">{waitingCount}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Teklif verilen</p>
            <p className="mt-3 text-3xl font-semibold">{quotedCount}</p>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Son müşteriler</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Şimdilik tabloyu canlı bağlantıdan test ediyoruz.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm text-zinc-400">
                  <th className="px-4 py-2">Ad Soyad</th>
                  <th className="px-4 py-2">Telefon</th>
                  <th className="px-4 py-2">İlgi Alanı</th>
                  <th className="px-4 py-2">Durum</th>
                  <th className="px-4 py-2">Sonraki Takip</th>
                </tr>
              </thead>
              <tbody>
                {customers && customers.length > 0 ? (
                  customers.map((customer) => (
                    <tr key={customer.id} className="bg-zinc-900/80 text-sm">
                      <td className="rounded-l-2xl px-4 py-3">
  <Link
    href={`/customers/${customer.id}`}
    className="font-medium text-pink-300 hover:text-pink-200 hover:underline"
  >
    {customer.full_name}
  </Link>
</td>
                      <td className="px-4 py-3">{customer.phone}</td>
                      <td className="px-4 py-3">{customer.service_interest ?? "-"}</td>
                      <td className="px-4 py-3">{statusText(customer.status)}</td>
                      <td className="rounded-r-2xl px-4 py-3">
                        {formatDate(customer.next_follow_up_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-400">
                      Henüz müşteri kaydı yok. Sağ üstten yeni müşteri ekleyebilirsin.
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