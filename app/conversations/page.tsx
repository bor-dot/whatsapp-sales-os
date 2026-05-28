import Link from "next/link";
import { redirect } from "next/navigation";
import { ModuleNav, SetupNotice } from "@/components/ModuleNav";
import { OrganizationRequired } from "@/components/OrganizationSwitcher";
import { getOrganizationContext } from "@/lib/organizations";
import { isMissingTableError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

type WhatsappMessage = {
  id: string;
  customer_id: string | null;
  from_phone: string | null;
  to_phone: string | null;
  direction: "inbound" | "outbound";
  message_type: string;
  body: string | null;
  status: string | null;
  created_at: string;
};

type CustomerLookup = {
  id: string;
  full_name: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function ConversationsPage() {
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
          <ModuleNav currentPath="/conversations" />
          <OrganizationRequired />
        </div>
      </main>
    );
  }

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select(
      "id, customer_id, from_phone, to_phone, direction, message_type, body, status, created_at",
    )
    .eq("organization_id", currentOrganizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  const setupRequired = isMissingTableError(error);

  if (error && !setupRequired) {
    throw new Error(error.message);
  }

  const messages = setupRequired ? [] : ((data ?? []) as WhatsappMessage[]);
  const customerIds = Array.from(
    new Set(messages.map((message) => message.customer_id).filter(Boolean)),
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
  const inboundCount = messages.filter((message) => message.direction === "inbound").length;
  const outboundCount = messages.filter((message) => message.direction === "outbound").length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ModuleNav currentPath="/conversations" />

        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-zinc-400">Conversations</p>
          <h1 className="mt-2 text-3xl font-semibold">WhatsApp konuşmaları</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {currentOrganization?.name} için gelen webhook mesajları ve CRM’den çıkan
            mesajlar tek listede tutulur.
          </p>
        </header>

        {setupRequired ? (
          <SetupNotice>
            <strong>Veritabanı kurulumu eksik.</strong> Konuşma kayıtları için{" "}
            <span className="text-white">supabase/whatsapp_modules.sql</span> dosyasındaki
            `whatsapp_messages` tablosunu Supabase SQL editor’de çalıştır.
          </SetupNotice>
        ) : null}

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Toplam mesaj</p>
            <p className="mt-3 text-3xl font-semibold">{messages.length}</p>
          </div>
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5">
            <p className="text-sm text-emerald-200/80">Gelen</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-100">{inboundCount}</p>
          </div>
          <div className="rounded-3xl border border-sky-400/20 bg-sky-500/10 p-5">
            <p className="text-sm text-sky-200/80">Giden</p>
            <p className="mt-3 text-3xl font-semibold text-sky-100">{outboundCount}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Son mesajlar</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Webhook worker gelen mesajları buraya yazar; send queue gönderim sonrası
              giden mesajları aynı hatta taşır.
            </p>
          </div>

          <div className="space-y-3">
            {messages.length > 0 ? (
              messages.map((message) => (
                <div
                  key={message.id}
                  className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {message.customer_id ? (
                          <Link
                            href={`/customers/${message.customer_id}`}
                            className="text-pink-300 hover:text-pink-200 hover:underline"
                          >
                            {customers.get(message.customer_id) ?? "Müşteri"}
                          </Link>
                        ) : (
                          "Eşleşmemiş contact"
                        )}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {message.direction === "inbound" ? message.from_phone : message.to_phone}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                      {message.direction === "inbound" ? "Gelen" : "Giden"} ·{" "}
                      {formatDate(message.created_at)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    {message.body || `${message.message_type} mesajı`}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 text-sm text-zinc-400">
                Henüz WhatsApp konuşması yok.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
