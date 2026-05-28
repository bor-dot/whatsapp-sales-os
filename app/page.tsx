import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

type HomePageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    source?: string;
    interest?: string;
    followup?: string;
    sort?: string;
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

function normalize(value: string | null) {
  return (value ?? "").trim();
}

function uniqueValues(customers: CustomerRow[], key: "source" | "service_interest") {
  return Array.from(
    new Set(customers.map((customer) => normalize(customer[key])).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "tr"));
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
    const aTime = a.next_follow_up_at
      ? new Date(a.next_follow_up_at).getTime()
      : Number.POSITIVE_INFINITY;
    const bTime = b.next_follow_up_at
      ? new Date(b.next_follow_up_at).getTime()
      : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
}

function followUpRank(value: string | null, now: Date) {
  if (isOverdue(value, now)) return 0;
  if (isToday(value, now)) return 1;
  if (isTomorrow(value, now)) return 2;
  if (isThisWeek(value, now)) return 3;
  if (!value) return 4;
  return 5;
}

function matchesFollowUpFilter(value: string | null, filter: string, now: Date) {
  switch (filter) {
    case "overdue":
      return isOverdue(value, now);
    case "today":
      return isToday(value, now);
    case "tomorrow":
      return isTomorrow(value, now);
    case "week":
      return (
        isThisWeek(value, now) &&
        !isToday(value, now) &&
        !isTomorrow(value, now)
      );
    case "none":
      return !value;
    default:
      return true;
  }
}

function sortCustomers(customers: CustomerRow[], sort: string, now: Date) {
  return [...customers].sort((a, b) => {
    if (sort === "newest") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    const aHasFollowUp = Boolean(a.next_follow_up_at);
    const bHasFollowUp = Boolean(b.next_follow_up_at);
    const aFollowUp = aHasFollowUp
      ? new Date(a.next_follow_up_at as string).getTime()
      : Number.POSITIVE_INFINITY;
    const bFollowUp = bHasFollowUp
      ? new Date(b.next_follow_up_at as string).getTime()
      : Number.POSITIVE_INFINITY;

    if (sort === "followup_desc") {
      if (!aHasFollowUp && !bHasFollowUp) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (!aHasFollowUp) return 1;
      if (!bHasFollowUp) return -1;
      return bFollowUp - aFollowUp;
    }

    if (sort === "followup_asc") {
      return aFollowUp - bFollowUp;
    }

    const rankDiff =
      followUpRank(a.next_follow_up_at, now) - followUpRank(b.next_follow_up_at, now);

    if (rankDiff !== 0) return rankDiff;
    return aFollowUp - bFollowUp;
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
  const source = params.source?.trim() ?? "all";
  const interest = params.interest?.trim() ?? "all";
  const followup = params.followup?.trim() ?? "all";
  const sort = params.sort?.trim() ?? "priority";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const customersQuery = supabase
    .from("customers")
    .select(
      "id, full_name, phone, source, service_interest, status, next_follow_up_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  const { data: customers, error } = await customersQuery;

  if (error) {
    throw new Error(error.message);
  }

  const allCustomers = (customers ?? []) as CustomerRow[];
  const sourceOptions = uniqueValues(allCustomers, "source");
  const interestOptions = uniqueValues(allCustomers, "service_interest");
  const normalizedQ = q.toLocaleLowerCase("tr");
  const now = new Date();
  const list = allCustomers.filter((customer) => {
    const matchesQuery =
      !normalizedQ ||
      [
        customer.full_name,
        customer.phone,
        customer.source,
        customer.service_interest,
      ].some((value) => normalize(value).toLocaleLowerCase("tr").includes(normalizedQ));

    const matchesStatus = status === "all" || customer.status === status;
    const matchesSource = source === "all" || normalize(customer.source) === source;
    const matchesInterest =
      interest === "all" || normalize(customer.service_interest) === interest;
    const matchesFollowUp = matchesFollowUpFilter(
      customer.next_follow_up_at,
      followup,
      now,
    );

    return (
      matchesQuery &&
      matchesStatus &&
      matchesSource &&
      matchesInterest &&
      matchesFollowUp
    );
  });

  const totalCustomers = list.length;
  const allCustomerCount = allCustomers.length;
  const waitingCount = list.filter((item) => item.status === "waiting").length;
  const quotedCount = list.filter((item) => item.status === "quoted").length;
  const wonCount = list.filter((item) => item.status === "won").length;
  const appointmentCount = list.filter((item) => item.status === "appointment").length;
  const noFollowUpCount = list.filter((item) => !item.next_follow_up_at).length;

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
  const activePipelineCount = list.filter(
    (item) => !["won", "lost"].includes(item.status),
  ).length;
  const noFollowUpCustomers = list.filter((item) => !item.next_follow_up_at);
  const displayCustomers = sortCustomers(list, sort, now);
  const topSource =
    sourceOptions
      .map((item) => ({
        name: item,
        count: list.filter((customer) => normalize(customer.source) === item).length,
      }))
      .sort((a, b) => b.count - a.count)[0] ?? null;

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

          <form method="get" className="grid gap-4 lg:grid-cols-[1fr_170px_170px_170px_170px_170px]">
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

            <select
              name="source"
              defaultValue={source}
              className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
            >
              <option value="all">Tüm kaynaklar</option>
              {sourceOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              name="interest"
              defaultValue={interest}
              className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
            >
              <option value="all">Tüm ilgi alanları</option>
              {interestOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              name="followup"
              defaultValue={followup}
              className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
            >
              <option value="all">Tüm takipler</option>
              <option value="overdue">Gecikenler</option>
              <option value="today">Bugün</option>
              <option value="tomorrow">Yarın</option>
              <option value="week">Bu hafta</option>
              <option value="none">Takipsiz</option>
            </select>

            <select
              name="sort"
              defaultValue={sort}
              className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
            >
              <option value="priority">Öncelik sırası</option>
              <option value="followup_asc">Takip tarihi yakın</option>
              <option value="followup_desc">Takip tarihi uzak</option>
              <option value="newest">Yeni kayıtlar</option>
            </select>

            <button
              type="submit"
              className="rounded-2xl bg-pink-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-pink-400 lg:col-start-5"
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Gösterilen müşteri</p>
            <p className="mt-3 text-3xl font-semibold">{totalCustomers}</p>
            <p className="mt-2 text-xs text-zinc-500">{allCustomerCount} toplam kayıt</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Aktif takip havuzu</p>
            <p className="mt-3 text-3xl font-semibold">{activePipelineCount}</p>
            <p className="mt-2 text-xs text-zinc-500">Kazanıldı/kaybedildi hariç</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Bekleyen</p>
            <p className="mt-3 text-3xl font-semibold">{waitingCount}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Teklif verilen</p>
            <p className="mt-3 text-3xl font-semibold">{quotedCount}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Randevu</p>
            <p className="mt-3 text-3xl font-semibold">{appointmentCount}</p>
          </div>

          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200/80">Kazanılan</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-100">{wonCount}</p>
          </div>

          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5">
            <p className="text-sm text-rose-200/80">Geciken takipler</p>
            <p className="mt-3 text-3xl font-semibold text-rose-100">
              {overdueCustomers.length}
            </p>
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

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Takip tarihi yok</p>
            <p className="mt-3 text-3xl font-semibold">{noFollowUpCount}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">En güçlü kaynak</p>
            <p className="mt-3 truncate text-2xl font-semibold">
              {topSource?.count ? topSource.name : "-"}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {topSource?.count ? `${topSource.count} müşteri` : "Veri yok"}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Öncelik sistemi</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Takip listesi aciliyet sırasına göre okunur: gecikenler, bugün, yarın,
              bu hafta ve takipsiz müşteriler.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
              <p className="text-xs font-medium uppercase text-rose-200/80">1. Geciken</p>
              <p className="mt-2 text-2xl font-semibold text-rose-100">
                {overdueCustomers.length}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
              <p className="text-xs font-medium uppercase text-amber-200/80">2. Bugün</p>
              <p className="mt-2 text-2xl font-semibold text-amber-100">
                {todayCustomers.length}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
              <p className="text-xs font-medium uppercase text-sky-200/80">3. Yarın</p>
              <p className="mt-2 text-2xl font-semibold text-sky-100">
                {tomorrowCustomers.length}
              </p>
            </div>
            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
              <p className="text-xs font-medium uppercase text-violet-200/80">4. Bu hafta</p>
              <p className="mt-2 text-2xl font-semibold text-violet-100">
                {thisWeekCustomers.length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
              <p className="text-xs font-medium uppercase text-zinc-400">5. Takipsiz</p>
              <p className="mt-2 text-2xl font-semibold">{noFollowUpCustomers.length}</p>
            </div>
          </div>
        </section>

        <FollowUpTable
          title="Geciken Takipler"
          subtitle="İlk ele alınması gereken, takip tarihi geçmiş müşteriler."
          customers={overdueCustomers}
          emptyMessage="Geciken takip yok."
          priorityLabel="Gecikmiş"
          priorityClass="border-rose-400/20 bg-rose-500/15 text-rose-200"
        />

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
          title="Takipsiz Müşteriler"
          subtitle="Henüz sonraki takip tarihi girilmemiş müşteriler."
          customers={noFollowUpCustomers}
          emptyMessage="Takipsiz müşteri yok."
          priorityLabel="Takipsiz"
          priorityClass="border-white/10 bg-white/5 text-zinc-200"
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
                {displayCustomers.length > 0 ? (
                  displayCustomers.map((customer) => (
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
                      {allCustomers.length === 0
                        ? "Henüz müşteri kaydı yok. Yeni müşteri ekleyerek başlayabilirsin."
                        : "Bu filtrelerle sonuç bulunamadı. Filtreleri temizleyip tekrar deneyebilirsin."}
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
