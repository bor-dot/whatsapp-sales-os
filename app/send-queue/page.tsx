import Link from "next/link";
import { redirect } from "next/navigation";
import { ModuleNav, SetupNotice } from "@/components/ModuleNav";
import { OrganizationRequired } from "@/components/OrganizationSwitcher";
import { getOrganizationContext } from "@/lib/organizations";
import { isMissingTableError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

type QueueItem = {
  id: string;
  customer_id: string | null;
  to_phone: string;
  message_body: string;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  scheduled_at: string;
  sent_at: string | null;
  error_message: string | null;
  attempt_count: number | null;
};

type CustomerLookup = {
  id: string;
  full_name: string;
};

type WhatsappConnection = {
  is_connected: boolean;
  display_phone_number: string | null;
  phone_number_id: string | null;
};

function queueStatusText(status: QueueItem["status"]) {
  switch (status) {
    case "pending":
      return "Bekliyor";
    case "processing":
      return "İşleniyor";
    case "sent":
      return "Gönderildi";
    case "failed":
      return "Başarısız";
    case "cancelled":
      return "İptal edildi";
    default:
      return status;
  }
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function SendQueuePage() {
  const supabase = await createClient();
  const { user, currentOrganization, currentOrganizationId } =
    await getOrganizationContext();

  if (!user) {
    redirect("/login");
  }

  if (!currentOrganizationId) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <ModuleNav currentPath="/send-queue" />
          <OrganizationRequired />
        </div>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("whatsapp_send_queue")
    .select(
      "id, customer_id, to_phone, message_body, status, scheduled_at, sent_at, error_message, attempt_count",
    )
    .eq("organization_id", currentOrganizationId)
    .order("scheduled_at", { ascending: false })
    .limit(100);
  const setupRequired = isMissingTableError(error);

  if (error && !setupRequired) {
    throw new Error(error.message);
  }

  const queue = setupRequired ? [] : ((data ?? []) as QueueItem[]);
  const customerIds = Array.from(
    new Set(queue.map((item) => item.customer_id).filter(Boolean)),
  ) as string[];
  const { data: customerRows } = customerIds.length
    ? await supabase
        .from("customers")
        .select("id, full_name")
        .eq("organization_id", currentOrganizationId)
        .in("id", customerIds)
    : { data: [] };
  const customers = new Map(
    ((customerRows ?? []) as CustomerLookup[]).map((customer) => [
      customer.id,
      customer.full_name,
    ]),
  );
  const pendingCount = queue.filter((item) => item.status === "pending").length;
  const failedCount = queue.filter((item) => item.status === "failed").length;
  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("is_connected, display_phone_number, phone_number_id")
    .eq("organization_id", currentOrganizationId)
    .maybeSingle();
  const whatsappConnection = connection as WhatsappConnection | null;
  const workerEnvReady = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.WEBHOOK_WORKER_SECRET,
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ModuleNav currentPath="/send-queue" />

        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-zinc-400">Mesaj Kuyruğu</p>
          <h1 className="mt-2 text-3xl font-semibold">CRM’den çıkan WhatsApp kuyruğu</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {currentOrganization?.name} için işleyici bekleyen mesajları merkez
            bağlantısıyla WhatsApp Cloud API’ye gönderir.
          </p>
        </header>

        {setupRequired ? (
          <SetupNotice>
            <strong>whatsapp_send_queue tablosu eksik.</strong> SQL kurulumu tamamlanınca
            mesaj kuyruğu burada görünür.
          </SetupNotice>
        ) : null}

        {!workerEnvReady ? (
          <SetupNotice>
            Gönderim işleyicisi için sunucu ortam değişkenleri eksik. `.env.example` içindeki
            SUPABASE_SERVICE_ROLE_KEY ve WEBHOOK_WORKER_SECRET değerleri Vercel’e girilmeli.
          </SetupNotice>
        ) : null}

        {!whatsappConnection ? (
          <SetupNotice>
            Bu merkez için WhatsApp bağlantısı yok. Mesaj göndermek için WhatsApp
            Bağlantısı ekranından bağlantı bilgilerini gir.
          </SetupNotice>
        ) : null}

        {whatsappConnection && !whatsappConnection.is_connected ? (
          <SetupNotice>
            WhatsApp bağlantısı var ama bağlı değil. Kuyruk güvenli şekilde bekler veya
            işleyici bağlantı hatası yazar.
          </SetupNotice>
        ) : null}

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Kuyruk kaydı</p>
            <p className="mt-3 text-3xl font-semibold">{queue.length}</p>
          </div>
          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-200/80">Bekleyen</p>
            <p className="mt-3 text-3xl font-semibold text-amber-100">{pendingCount}</p>
          </div>
          <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5">
            <p className="text-sm text-rose-200/80">Başarısız</p>
            <p className="mt-3 text-3xl font-semibold text-rose-100">{failedCount}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Kuyruk</h2>
          <div className="mt-4 space-y-3">
            {queue.length > 0 ? (
              queue.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-medium">
                      {item.customer_id ? (
                        <Link
                          href={`/customers/${item.customer_id}`}
                          className="text-pink-300 hover:text-pink-200 hover:underline"
                        >
                          {customers.get(item.customer_id) ?? "Müşteri"}
                        </Link>
                      ) : (
                        item.to_phone
                      )}
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                      {queueStatusText(item.status)} · {formatDate(item.scheduled_at)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{item.message_body}</p>
                  {item.error_message ? (
                    <p className="mt-2 text-sm text-rose-200">{item.error_message}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-zinc-500">
                    Deneme: {item.attempt_count ?? 0} · Gönderim: {formatDate(item.sent_at)}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 text-sm text-zinc-400">
                Kuyrukta mesaj yok.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
