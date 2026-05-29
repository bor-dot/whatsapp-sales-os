import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/supabase/errors";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/send";

type QueueItem = {
  id: string;
  owner_id: string | null;
  organization_id: string | null;
  customer_id: string | null;
  to_phone: string;
  message_body: string;
  attempt_count: number | null;
};

type WhatsappConnection = {
  phone_number_id: string | null;
  access_token_encrypted: string | null;
  business_account_id: string | null;
  is_connected: boolean;
};

function isAuthorized(request: NextRequest) {
  const secret = process.env.WEBHOOK_WORKER_SECRET;
  if (!secret) return false;

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const workerSecret = request.headers.get("x-worker-secret");

  return bearer === secret || workerSecret === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, setupRequired: true, error: "WEBHOOK_WORKER_SECRET eksik veya hatalı." },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, setupRequired: true, error: "SUPABASE_SERVICE_ROLE_KEY eksik." },
      { status: 503 },
    );
  }
  const admin = supabase;

  const { data, error } = await admin
    .from("whatsapp_send_queue")
    .select("id, owner_id, organization_id, customer_id, to_phone, message_body, attempt_count")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        setupRequired: isMissingTableError(error),
        error: error.message,
      },
      { status: isMissingTableError(error) ? 503 : 500 },
    );
  }

  const queue = (data ?? []) as QueueItem[];
  const results = [];
  const ownerFallbacks = new Map<string, string | null>();

  async function getFallbackOwnerId(organizationId: string) {
    if (ownerFallbacks.has(organizationId)) {
      return ownerFallbacks.get(organizationId) ?? null;
    }

    const { data: member } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const userId =
      member && "user_id" in member && typeof member.user_id === "string"
        ? member.user_id
        : null;

    ownerFallbacks.set(organizationId, userId);
    return userId;
  }

  for (const item of queue) {
    if (!item.organization_id) {
      await supabase
        .from("whatsapp_send_queue")
        .update({
          status: "failed",
          error_message: "Kuyruk kaydında merkez bilgisi yok.",
        })
        .eq("id", item.id);
      results.push({ id: item.id, ok: false, setupRequired: true, status: null });
      continue;
    }

    const { data: connection } = await supabase
      .from("whatsapp_connections")
      .select("phone_number_id, access_token_encrypted, business_account_id, is_connected")
      .eq("organization_id", item.organization_id)
      .eq("is_connected", true)
      .maybeSingle();
    const whatsappConnection = connection as WhatsappConnection | null;

    if (!whatsappConnection) {
      await supabase
        .from("whatsapp_send_queue")
        .update({
          status: "failed",
          error_message: "Merkez için bağlı WhatsApp bağlantısı bulunamadı.",
        })
        .eq("id", item.id)
        .eq("organization_id", item.organization_id);
      results.push({ id: item.id, ok: false, setupRequired: true, status: null });
      continue;
    }

    await supabase
      .from("whatsapp_send_queue")
      .update({
        status: "processing",
        attempt_count: (item.attempt_count ?? 0) + 1,
      })
      .eq("id", item.id)
      .eq("organization_id", item.organization_id);

    const result = await sendWhatsAppTextMessage({
      to: item.to_phone,
      body: item.message_body,
      connection: whatsappConnection,
    });
    const metaMessageId =
      result.data &&
      typeof result.data === "object" &&
      "messages" in result.data &&
      Array.isArray(result.data.messages)
        ? result.data.messages[0]?.id
        : null;

    await supabase
      .from("whatsapp_send_queue")
      .update({
        status: result.ok ? "sent" : "failed",
        sent_at: result.ok ? new Date().toISOString() : null,
        error_message: result.ok ? null : result.error,
        meta_message_id: metaMessageId,
        meta_response: result.data,
      })
      .eq("id", item.id)
      .eq("organization_id", item.organization_id);

    if (result.ok) {
      const ownerId = item.owner_id ?? (await getFallbackOwnerId(item.organization_id));

      if (ownerId) {
        await supabase.from("whatsapp_messages").insert({
          owner_id: ownerId,
          organization_id: item.organization_id,
          customer_id: item.customer_id,
          wa_message_id: metaMessageId,
          from_phone: null,
          to_phone: item.to_phone,
          normalized_phone: normalizePhone(item.to_phone),
          direction: "outbound",
          message_type: "text",
          body: item.message_body,
          status: "sent",
          payload: result.data,
        });
      }
    }

    results.push({
      id: item.id,
      ok: result.ok,
      setupRequired: result.setupRequired,
      status: result.status ?? null,
    });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
