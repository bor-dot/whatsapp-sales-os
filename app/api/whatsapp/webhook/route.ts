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
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        messages?: WhatsappInboundMessage[];
        statuses?: WhatsappStatus[];
      };
    }>;
  }>;
};

type CustomerForMatch = {
  id: string;
  owner_id: string;
  organization_id: string;
  phone: string | null;
  whatsapp_phone: string | null;
};

type WhatsappConnection = {
  organization_id: string;
  verify_token: string | null;
};

type OrganizationMember = {
  user_id: string;
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

function extractPhoneNumberId(payload: WhatsappPayload) {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (phoneNumberId) return phoneNumberId;
    }
  }

  return null;
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
  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, setupRequired: true, error: "SUPABASE_SERVICE_ROLE_KEY eksik." },
      { status: 503 },
    );
  }

  const { data: connection } = await supabase
    .from("whatsapp_connections")
    .select("organization_id, verify_token")
    .eq("verify_token", token)
    .eq("is_connected", true)
    .maybeSingle();

  if (mode === "subscribe" && challenge && connection) {
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
  const phoneNumberId = extractPhoneNumberId(payload);
  const { data: connection } = phoneNumberId
    ? await supabase
        .from("whatsapp_connections")
        .select("organization_id, verify_token")
        .eq("phone_number_id", phoneNumberId)
        .eq("is_connected", true)
        .maybeSingle()
    : { data: null };
  const whatsappConnection = connection as WhatsappConnection | null;
  const organizationId = whatsappConnection?.organization_id ?? null;

  await supabase.from("whatsapp_webhook_events").insert({
    organization_id: organizationId,
    provider: "whatsapp",
    event_id: messages[0]?.id ?? statuses[0]?.id ?? null,
    payload,
  });

  if (!organizationId) {
    return NextResponse.json({
      ok: true,
      mapped: false,
      inbound: messages.length,
      insertedMessages: 0,
      statuses: statuses.length,
    });
  }

  const { data: customerRows } = await supabase
    .from("customers")
    .select("id, owner_id, organization_id, phone, whatsapp_phone")
    .eq("organization_id", organizationId)
    .limit(1000);
  const { data: member } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const customers = (customerRows ?? []) as CustomerForMatch[];
  const fallbackOwnerId = (member as OrganizationMember | null)?.user_id ?? null;
  let insertedMessages = 0;

  for (const message of messages) {
    const customer = customers.find(
      (item) =>
        phoneMatches(item.whatsapp_phone, message.from) || phoneMatches(item.phone, message.from),
    );
    const ownerId = customer?.owner_id ?? fallbackOwnerId;

    if (!ownerId) continue;

    const { error } = await supabase.from("whatsapp_messages").upsert(
      {
        owner_id: ownerId,
        organization_id: organizationId,
        customer_id: customer?.id ?? null,
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
      .eq("meta_message_id", status.id)
      .eq("organization_id", organizationId);
  }

  return NextResponse.json({
    ok: true,
    mapped: true,
    organizationId,
    inbound: messages.length,
    insertedMessages,
    statuses: statuses.length,
  });
}
