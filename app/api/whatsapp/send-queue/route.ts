import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/supabase/errors";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/send";

type QueueItem = {
  id: string;
  to_phone: string;
  message_body: string;
  attempt_count: number | null;
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

  const { data, error } = await supabase
    .from("whatsapp_send_queue")
    .select("id, to_phone, message_body, attempt_count")
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

  for (const item of queue) {
    await supabase
      .from("whatsapp_send_queue")
      .update({
        status: "processing",
        attempt_count: (item.attempt_count ?? 0) + 1,
      })
      .eq("id", item.id);

    const result = await sendWhatsAppTextMessage({
      to: item.to_phone,
      body: item.message_body,
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
      .eq("id", item.id);

    results.push({
      id: item.id,
      ok: result.ok,
      setupRequired: result.setupRequired,
      status: result.status ?? null,
    });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
