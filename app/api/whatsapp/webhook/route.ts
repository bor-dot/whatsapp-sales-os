import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, phoneMatches } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

type WhatsappInboundMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: {
    body?: string;
  };
};

type WhatsappStatus = {
  id: string;
  status: string;
  timestamp?: string;
  recipient_id?: string;
};

type WhatsappPayload = {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messages?: WhatsappInboundMessage[];
        statuses?: WhatsappStatus[];
      };
    }>;
  }>;
};

type CustomerForMatch = {
  id: string;
  owner_id: string;
  phone: string | null;
  whatsapp_phone: string | null;
};

function extractMessages(payload: WhatsappPayload) {
  return (
    payload.entry?.flatMap(
      (entry) =>
        entry.changes?.flatMap((change) => change.value?.messages ?? []) ?? [],
    ) ?? []
  );
}

function extractStatuses(payload: WhatsappPayload) {
  return (
    payload.entry?.flatMap(
      (entry) =>
        entry.changes?.flatMap((change) => change.value?.statuses ?? []) ?? [],
    ) ?? []
  );
}

function messageBody(message: WhatsappInboundMessage) {
  if (message.type === "text") return message.text?.body ?? null;

  return null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    return NextResponse.json(
      { ok: false, setupRequired: true, error: "WHATSAPP_VERIFY_TOKEN eksik." },
      { status: 503 },
    );
  }

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ ok: false, error: "Webhook doğrulanamadı." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, setupRequired: true, error: "SUPABASE_SERVICE_ROLE_KEY eksik." },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as WhatsappPayload;
  const messages = extractMessages(payload);
  const statuses = extractStatuses(payload);

  await supabase.from("whatsapp_webhook_events").insert({
    provider: "whatsapp",
    event_id: messages[0]?.id ?? statuses[0]?.id ?? null,
    payload,
  });

  const { data: customerRows } = await supabase
    .from("customers")
    .select("id, owner_id, phone, whatsapp_phone")
    .limit(1000);
  const customers = (customerRows ?? []) as CustomerForMatch[];
  let insertedMessages = 0;

  for (const message of messages) {
    const customer = customers.find(
      (item) =>
        phoneMatches(item.whatsapp_phone, message.from) || phoneMatches(item.phone, message.from),
    );

    if (!customer) continue;

    const { error } = await supabase.from("whatsapp_messages").upsert(
      {
        owner_id: customer.owner_id,
        customer_id: customer.id,
        wa_message_id: message.id,
        from_phone: message.from,
        to_phone: null,
        normalized_phone: normalizePhone(message.from),
        direction: "inbound",
        message_type: message.type,
        body: messageBody(message),
        status: "received",
        payload: message,
        created_at: message.timestamp
          ? new Date(Number(message.timestamp) * 1000).toISOString()
          : new Date().toISOString(),
      },
      { onConflict: "wa_message_id" },
    );

    if (!error) {
      insertedMessages += 1;
    }
  }

  for (const status of statuses) {
    await supabase
      .from("whatsapp_send_queue")
      .update({
        delivery_status: status.status,
        meta_response: status,
      })
      .eq("meta_message_id", status.id);
  }

  return NextResponse.json({
    ok: true,
    inbound: messages.length,
    insertedMessages,
    statuses: statuses.length,
  });
}
