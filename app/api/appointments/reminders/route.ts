import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/supabase/errors";
import { normalizePhone } from "@/lib/phone";
import { DEFAULT_MESSAGE_TEMPLATES, renderTemplate } from "@/lib/whatsapp/templates";

type AppointmentForReminder = {
  id: string;
  owner_id: string;
  organization_id: string | null;
  customer_id: string;
  starts_at: string;
  reminder_status: string | null;
  confirmation_status: string | null;
};

type CustomerForReminder = {
  id: string;
  organization_id: string | null;
  full_name: string;
  phone: string;
  whatsapp_phone: string | null;
};

function isAuthorized(request: NextRequest) {
  const secret = process.env.WEBHOOK_WORKER_SECRET;
  if (!secret) return false;

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const workerSecret = request.headers.get("x-worker-secret");

  return bearer === secret || workerSecret === secret;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

  const now = new Date();
  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);

  const { data, error } = await supabase
    .from("appointments")
    .select("id, owner_id, organization_id, customer_id, starts_at, reminder_status, confirmation_status")
    .eq("status", "scheduled")
    .not("organization_id", "is", null)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", nextDay.toISOString())
    .limit(50);

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

  const appointments = (data ?? []) as AppointmentForReminder[];
  const customerIds = Array.from(new Set(appointments.map((item) => item.customer_id)));
  const organizationIds = Array.from(
    new Set(
      appointments
        .map((item) => item.organization_id)
        .filter((organizationId): organizationId is string => Boolean(organizationId)),
    ),
  );
  const { data: customerRows } = customerIds.length
    ? await supabase
        .from("customers")
        .select("id, organization_id, full_name, phone, whatsapp_phone")
        .in("id", customerIds)
        .in("organization_id", organizationIds)
    : { data: [] };
  const customers = new Map(
    ((customerRows ?? []) as CustomerForReminder[]).map((customer) => [
      customer.id,
      customer,
    ]),
  );
  const reminderTemplate = DEFAULT_MESSAGE_TEMPLATES.find(
    (template) => template.key === "appointment_reminder",
  );
  let queued = 0;

  for (const appointment of appointments) {
    if (appointment.reminder_status === "queued" || !reminderTemplate) continue;
    if (!appointment.organization_id) continue;

    const customer = customers.get(appointment.customer_id);
    if (!customer) continue;
    if (customer.organization_id !== appointment.organization_id) continue;

    const toPhone = normalizePhone(customer.whatsapp_phone || customer.phone);
    if (!toPhone) continue;

    const body = renderTemplate(reminderTemplate.body, {
      name: customer.full_name,
      time: formatDate(appointment.starts_at),
    });

    const queueResult = await supabase.from("whatsapp_send_queue").insert({
      owner_id: appointment.owner_id,
      organization_id: appointment.organization_id,
      customer_id: appointment.customer_id,
      to_phone: toPhone,
      message_body: body,
      status: "pending",
      scheduled_at: now.toISOString(),
    });

    if (!queueResult.error) {
      queued += 1;
      await supabase
        .from("appointments")
        .update({ reminder_status: "queued" })
        .eq("id", appointment.id)
        .eq("organization_id", appointment.organization_id);
    }
  }

  return NextResponse.json({ ok: true, scanned: appointments.length, queued });
}
