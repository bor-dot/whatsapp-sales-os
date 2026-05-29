import { NextRequest, NextResponse } from "next/server";
import { normalizePhone, phoneMatches } from "@/lib/phone";
import { resolveMetaAccessToken, type MetaConnection, type MetaProvider } from "@/lib/meta/connection";
import { createAdminClient } from "@/lib/supabase/admin";

type MetaLeadField = {
  name: string;
  values?: string[];
};

type MetaLeadPayload = {
  id?: string;
  created_time?: string;
  field_data?: MetaLeadField[];
  ad_id?: string;
  campaign_id?: string;
  form_id?: string;
  platform?: string;
};

type MetaLeadWebhookValue = {
  leadgen_id?: string;
  page_id?: string;
  form_id?: string;
  ad_id?: string;
  campaign_id?: string;
  created_time?: number;
};

type MetaWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    time?: number;
    changes?: Array<{
      field?: string;
      value?: MetaLeadWebhookValue;
    }>;
    messaging?: Array<{
      sender?: { id?: string };
      recipient?: { id?: string };
      message?: { mid?: string; text?: string };
      timestamp?: number;
    }>;
  }>;
};

type CustomerForMatch = {
  id: string;
  phone: string | null;
  whatsapp_phone: string | null;
};

type OrganizationMember = {
  user_id: string;
};

function graphVersion() {
  return process.env.META_GRAPH_API_VERSION ?? process.env.WHATSAPP_GRAPH_API_VERSION ?? "v23.0";
}

function eventId(payload: MetaWebhookPayload) {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.value?.leadgen_id) return change.value.leadgen_id;
    }

    for (const message of entry.messaging ?? []) {
      if (message.message?.mid) return message.message.mid;
    }
  }

  return null;
}

function providerFromPayload(payload: MetaWebhookPayload): MetaProvider {
  return payload.object === "instagram" ? "instagram" : "facebook";
}

function fieldValue(fields: MetaLeadField[], names: string[]) {
  const match = fields.find((field) => names.includes(field.name.toLowerCase()));
  return match?.values?.[0]?.trim() ?? null;
}

function leadValues(lead: MetaLeadPayload) {
  const fields = lead.field_data ?? [];
  const firstName = fieldValue(fields, ["first_name", "firstname", "ad"]);
  const lastName = fieldValue(fields, ["last_name", "lastname", "soyad"]);
  const fullName =
    fieldValue(fields, ["full_name", "name", "isim", "ad_soyad"]) ??
    [firstName, lastName].filter(Boolean).join(" ").trim() ??
    null;

  return {
    fullName: fullName || null,
    phone: fieldValue(fields, ["phone_number", "phone", "mobile_phone", "telefon"]),
    email: fieldValue(fields, ["email", "e-mail", "eposta", "e_posta"]),
    serviceInterest: fieldValue(fields, ["service", "service_interest", "hizmet", "ilgi_alani"]),
  };
}

async function findConnection(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  pageId: string | null,
  instagramId: string | null,
) {
  if (pageId) {
    const { data } = await supabase
      .from("meta_connections")
      .select(
        "id, organization_id, provider, display_name, page_id, instagram_business_account_id, ad_account_id, verify_token, access_token_encrypted, is_connected",
      )
      .eq("page_id", pageId)
      .eq("is_connected", true)
      .maybeSingle();

    if (data) return data as MetaConnection;
  }

  if (instagramId) {
    const { data } = await supabase
      .from("meta_connections")
      .select(
        "id, organization_id, provider, display_name, page_id, instagram_business_account_id, ad_account_id, verify_token, access_token_encrypted, is_connected",
      )
      .eq("instagram_business_account_id", instagramId)
      .eq("is_connected", true)
      .maybeSingle();

    if (data) return data as MetaConnection;
  }

  return null;
}

async function fallbackOwnerId(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  organizationId: string,
) {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data as OrganizationMember | null)?.user_id ?? null;
}

async function fetchLead(leadgenId: string, accessToken: string) {
  const fields = "created_time,field_data,ad_id,campaign_id,form_id,platform";
  const url = new URL(`https://graph.facebook.com/${graphVersion()}/${leadgenId}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  if (!response.ok) return null;

  return (await response.json().catch(() => null)) as MetaLeadPayload | null;
}

async function findExistingCustomer(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  organizationId: string,
  phone: string,
) {
  const { data } = await supabase
    .from("customers")
    .select("id, phone, whatsapp_phone")
    .eq("organization_id", organizationId)
    .limit(1000);

  return ((data ?? []) as CustomerForMatch[]).find(
    (customer) => phoneMatches(customer.phone, phone) || phoneMatches(customer.whatsapp_phone, phone),
  ) ?? null;
}

async function processLead(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  connection: MetaConnection,
  leadgenId: string,
  fallbackValue: MetaLeadWebhookValue | undefined,
) {
  const accessToken = resolveMetaAccessToken(connection.access_token_encrypted);
  const lead =
    accessToken ? await fetchLead(leadgenId, accessToken) : null;
  const leadData: MetaLeadPayload = {
    id: leadgenId,
    form_id: fallbackValue?.form_id,
    ad_id: fallbackValue?.ad_id,
    campaign_id: fallbackValue?.campaign_id,
    ...(lead ?? {}),
  };
  const values = leadValues(leadData);
  const ownerId = await fallbackOwnerId(supabase, connection.organization_id);
  const providerSource =
    connection.provider === "instagram"
      ? "Instagram Lead Reklamları"
      : "Facebook Lead Reklamları";
  let customerId: string | null = null;

  if (ownerId && values.phone) {
    const existingCustomer = await findExistingCustomer(
      supabase,
      connection.organization_id,
      values.phone,
    );

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: customer } = await supabase
        .from("customers")
        .insert({
          owner_id: ownerId,
          organization_id: connection.organization_id,
          full_name: values.fullName || "Meta form kaydı",
          phone: values.phone,
          whatsapp_phone: normalizePhone(values.phone),
          source: providerSource,
          service_interest: values.serviceInterest,
          status: "new",
          notes: [
            values.email ? `E-posta: ${values.email}` : null,
            leadData.form_id ? `Form ID: ${leadData.form_id}` : null,
            leadData.campaign_id ? `Kampanya ID: ${leadData.campaign_id}` : null,
            leadData.ad_id ? `Reklam ID: ${leadData.ad_id}` : null,
          ]
            .filter(Boolean)
            .join("\n") || null,
        })
        .select("id")
        .single();

      customerId =
        customer && "id" in customer && typeof customer.id === "string"
          ? customer.id
          : null;

      if (customerId) {
        await supabase.from("customer_logs").insert({
          owner_id: ownerId,
          organization_id: connection.organization_id,
          customer_id: customerId,
          log_type: "note",
          content: `${providerSource} üzerinden yeni lead oluşturuldu.`,
        });
      }
    }
  }

  await supabase.from("meta_leads").upsert(
    {
      organization_id: connection.organization_id,
      provider: connection.provider,
      lead_id: leadgenId,
      page_id: fallbackValue?.page_id ?? connection.page_id,
      form_id: leadData.form_id ?? null,
      ad_id: leadData.ad_id ?? null,
      campaign_id: leadData.campaign_id ?? null,
      full_name: values.fullName,
      phone: values.phone,
      email: values.email,
      payload: leadData,
      customer_id: customerId,
    },
    { onConflict: "organization_id,lead_id" },
  );

  return Boolean(customerId);
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
    .from("meta_connections")
    .select("id")
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

  const payload = (await request.json()) as MetaWebhookPayload;
  const provider = providerFromPayload(payload);
  let processedLeads = 0;
  let createdCustomers = 0;
  let mappedEvents = 0;

  for (const entry of payload.entry ?? []) {
    const instagramId =
      provider === "instagram"
        ? entry.id ?? entry.messaging?.[0]?.recipient?.id ?? null
        : null;
    const pageId = provider === "facebook" ? entry.id ?? null : null;

    for (const change of entry.changes ?? []) {
      const value = change.value;
      const connection = await findConnection(
        supabase,
        value?.page_id ?? pageId,
        instagramId,
      );

      await supabase.from("meta_webhook_events").insert({
        organization_id: connection?.organization_id ?? null,
        provider,
        event_id: value?.leadgen_id ?? eventId(payload),
        payload: { entry, change },
      });

      if (!connection) continue;
      mappedEvents += 1;

      if (change.field === "leadgen" && value?.leadgen_id) {
        processedLeads += 1;
        const created = await processLead(supabase, connection, value.leadgen_id, value);
        if (created) createdCustomers += 1;
      }
    }

    for (const message of entry.messaging ?? []) {
      const connection = await findConnection(
        supabase,
        pageId,
        instagramId ?? message.recipient?.id ?? null,
      );

      await supabase.from("meta_webhook_events").insert({
        organization_id: connection?.organization_id ?? null,
        provider,
        event_id: message.message?.mid ?? eventId(payload),
        payload: { entry, message },
      });

      if (connection) mappedEvents += 1;
    }
  }

  if (!payload.entry?.length) {
    await supabase.from("meta_webhook_events").insert({
      organization_id: null,
      provider,
      event_id: null,
      payload,
    });
  }

  return NextResponse.json({
    ok: true,
    provider,
    mappedEvents,
    processedLeads,
    createdCustomers,
  });
}
