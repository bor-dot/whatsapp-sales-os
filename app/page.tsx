import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

type HomePageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
  }>;
};

type CustomerRow = {
  id: string;
  full_name: string;
  phone: string;
  source: string | null;
  service_interest: string | null;
  status: string;
  next_follow_up_at: string | null;
  created_at: string;
};

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

function statusBadgeClass(status: string) {
  switch (status) {
    case "new":
      return "bg-blue-500/15 text-blue-200 border-blue-400/20";
    case "contacted":
      return "bg-cyan-500/15 text-cyan-200 border-cyan-400/20";
    case "quoted":
      return "bg-amber-500/15 text-amber-200 border-amber-400/20";
    case "waiting":
      return "bg-yellow-500/15 text-yellow-200 border-yellow-400/20";
    case "appointment":
      return "bg-purple-500/15 text-purple-200 border-purple-400/20";
    case "won":
      return "bg-emerald-500/15 text-emerald-200 border-emerald-400/20";
    case "lost":
      return "bg-rose-500/15 text-rose-200 border-rose-400/20";
    default:
      return "bg-white/5 text-zinc-200 border-white/10";
  }
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function isSameDay(date: Date, base: Date) {
  return (
    date.getFullYear() === base.getFullYear() &&
    date.getMonth() === base.getMonth() &&
    date.getDate() === base.getDate()
  );
}

function isToday(value: string | null, now: Date) {
  if (!value) return false;
  return isSameDay(new Date(value), now);
}

function isTomorrow(value: string | null, now: Date) {
  if (!value) return false;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(new Date(value), tomorrow);
}

function isOverdue(value: string | null, now: Date) {
  if (!value) return false;
  return startOfDay(new Date(value)).getTime() < startOfDay(now).getTime();
}

function isThisWeek(value: string | null, now: Date) {
  if (!value) return false;

  const target = new Date(value);
  const todayStart = startOfDay(now);
  const weekEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6));

  return target.getTime() >= todayStart.getTime() && target.getTime() <= weekEnd.getTime();
}

function sortByFollowUpAsc(customers: CustomerRow[]) {
  return [...customers].sort((a, b) => {
    const aTime = a.next_follow_up_at ? new Date(a.next_follow_up_at).getTime() : 0;
    const bTime = b.next_follow_up_at ? new Date(b.next_follow_up_at).getTime() : 0;
    return aTime - bTime;
  });
}

function FollowUpTable({
  title,
  subtitle,
  customers,
  emptyMessage,
  priorityLabel,
  priorityClass,
}: {
  title: string;
  subtitle: string;
  customers: CustomerRow[];
  emptyMessage: string;
  priorityLabel: string;
  priorityClass: string;
}) {
  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-2">
          <thead>
            <tr className="text-left text-sm text-zinc-400">
              <th className="px-4 py-2">Ad Soyad</th>
              <th className="px-4 py-2">Telefon</th>
              <th className="px-4 py-2">Kaynak</th>
              <th className="px-4 py-2">İlgi Alanı</th>
              <th className="px-4 py-2">Durum</th>
              <th className="px-4 py-2">Takip Zamanı</th>
              <th className="px-4 py-2">Öncelik</th>
            </tr>
          </thead>
          <tbody>
            {customers.length > 0 ? (
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
                  <td className="px-4 py-3">{customer.source ?? "-"}</td>
                  <td className="px-4 py-3">{customer.service_interest ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                        customer.status,
                      )}`}
                    >
                      {statusText(customer.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDate(customer.next_follow_up_at)}</td>
                  <td className="rounded-r-2xl px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${priorityClass}`}
                    >
                      {priorityLabel}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "all";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let customersQuery = supabase
    .from("customers")
    .select(
      "id, full_name, phone, source, service_interest, status, next_follow_up_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (q) {
    const safeQuery = q.replace(/,/g, "\\,");
    customersQuery = customersQuery.or(
      `full_name.ilike.%${safeQuery}%,phone.ilike.%${safeQuery}%,service_interest.ilike.%${safeQuery}%,source.ilike.%${safeQuery}%`,
    );
  }

  if (status !== "all") {
    customersQuery = customersQuery.eq("status", status);
  }

  const { data: customers, error } = await customersQuery;

  if (error) {
    throw new Error(error.message);
  }

  const list = (customers ?? []) as CustomerRow[];
  const now = new Date();

  const totalCustomers = list.length;
  const waitingCount = list.filter((item) => item.status === "waiting").length;
  const quotedCount = list.filter((item) => item.status === "quoted").length;

  const todayCustomers = sortByFollowUpAsc(
    list.filter((item) => isToday(item.next_follow_up_at, now)),
  );

  const tomorrowCustomers = sortByFollowUpAsc(
    list.filter((item) => isTomorrow(item.next_follow_up_at, now)),
  );

  const overdueCustomers = sortByFollowUpAsc(
    list.filter((item) => isOverdue(item.next_follow_up_at, now)),
  );

  const thisWeekCustomers = sortByFollowUpAsc(
    list.filter(
      (item) =>
        isThisWeek(item.next_follow_up_at, now) &&
        !isToday(item.next_follow_up_at, now) &&
        !isTomorrow(item.next_follow_up_at, now),
    ),
  );

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

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Arama ve Filtre</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Ad, telefon, kaynak veya ilgi alanına göre filtrele.
            </p>
          </div>

          <form method="get" className="grid gap-4 md:grid-cols-[1fr_220px_auto_auto]">
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Ad, telefon, kaynak, işlem..."
              className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
            />

            <select
              name="status"
              defaultValue={status}
              className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
            >
              <option value="all">Tüm durumlar</option>
              <option value="new">Yeni</option>
              <option value="contacted">Görüşüldü</option>
              <option value="quoted">Teklif</option>
              <option value="waiting">Bekliyor</option>
              <option value="appointment">Randevu</option>
              <option value="won">Kazanıldı</option>
              <option value="lost">Kaybedildi</option>
            </select>

            <button
              type="submit"
              className="rounded-2xl bg-pink-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-pink-400"
            >
              Filtrele
            </button>

            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium hover:bg-white/10"
            >
              Temizle
            </Link>
          </form>
        </section>

        <section className="grid gap-4 sm:grid-cols-7">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Gösterilen müşteri</p>
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

          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-200/80">Bugün aranacaklar</p>
            <p className="mt-3 text-3xl font-semibold text-amber-100">
              {todayCustomers.length}
            </p>
          </div>

          <div className="rounded-3xl border border-sky-400/20 bg-sky-500/10 p-5">
            <p className="text-sm text-sky-200/80">Yarın aranacaklar</p>
            <p className="mt-3 text-3xl font-semibold text-sky-100">
              {tomorrowCustomers.length}
            </p>
          </div>

          <div className="rounded-3xl border border-violet-400/20 bg-violet-500/10 p-5">
            <p className="text-sm text-violet-200/80">Bu hafta</p>
            <p className="mt-3 text-3xl font-semibold text-violet-100">
              {thisWeekCustomers.length}
            </p>
          </div>

          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5">
            <p className="text-sm text-rose-200/80">Geciken takipler</p>
            <p className="mt-3 text-3xl font-semibold text-rose-100">
              {overdueCustomers.length}
            </p>
          </div>
        </section>

        <FollowUpTable
          title="Bugün Aranacaklar"
          subtitle="Bugün takip edilmesi gereken müşteriler."
          customers={todayCustomers}
          emptyMessage="Bugün aranacak müşteri yok."
          priorityLabel="Bugün"
          priorityClass="border-amber-400/20 bg-amber-500/15 text-amber-200"
        />

        <FollowUpTable
          title="Yarın Aranacaklar"
          subtitle="Yarın için planlanan takipler."
          customers={tomorrowCustomers}
          emptyMessage="Yarın için planlanan müşteri yok."
          priorityLabel="Yarın"
          priorityClass="border-sky-400/20 bg-sky-500/15 text-sky-200"
        />

        <FollowUpTable
          title="Bu Hafta"
          subtitle="Bugün ve yarın dışındaki haftalık takipler."
          customers={thisWeekCustomers}
          emptyMessage="Bu hafta için ek takip yok."
          priorityLabel="Bu Hafta"
          priorityClass="border-violet-400/20 bg-violet-500/15 text-violet-200"
        />

        <FollowUpTable
          title="Geciken Takipler"
          subtitle="Takip tarihi geçmiş müşteriler."
          customers={overdueCustomers}
          emptyMessage="Geciken takip yok."
          priorityLabel="Gecikmiş"
          priorityClass="border-rose-400/20 bg-rose-500/15 text-rose-200"
        />

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Müşteriler</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Arama ve filtreye göre listeleniyor.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm text-zinc-400">
                  <th className="px-4 py-2">Ad Soyad</th>
                  <th className="px-4 py-2">Telefon</th>
                  <th className="px-4 py-2">Kaynak</th>
                  <th className="px-4 py-2">İlgi Alanı</th>
                  <th className="px-4 py-2">Durum</th>
                  <th className="px-4 py-2">Sonraki Takip</th>
                </tr>
              </thead>
              <tbody>
                {list.length > 0 ? (
                  list.map((customer) => (
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
                      <td className="px-4 py-3">{customer.source ?? "-"}</td>
                      <td className="px-4 py-3">{customer.service_interest ?? "-"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusBadgeClass(
                            customer.status,
                          )}`}
                        >
                          {statusText(customer.status)}
                        </span>
                      </td>
                      <td className="rounded-r-2xl px-4 py-3">
                        {formatDate(customer.next_follow_up_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-400">
                      Sonuç bulunamadı.
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