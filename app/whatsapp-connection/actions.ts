"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrganizationContext } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function saveWhatsappConnection(formData: FormData) {
  const { user, currentOrganizationId } = await getOrganizationContext();

  if (!user) {
    redirect("/login");
  }

  if (!currentOrganizationId) {
    redirect("/whatsapp-connection");
  }

  const supabase = await createClient();
  const accessToken = textValue(formData, "access_token");
  const payload: Record<string, string | boolean | null> = {
    organization_id: currentOrganizationId,
    display_phone_number: textValue(formData, "display_phone_number") || null,
    phone_number_id: textValue(formData, "phone_number_id") || null,
    business_account_id: textValue(formData, "business_account_id") || null,
    verify_token: textValue(formData, "verify_token") || null,
    is_connected: formData.get("is_connected") === "on",
    updated_at: new Date().toISOString(),
  };

  if (accessToken) {
    // TODO: Replace plain storage with encryption/decryption when a KMS key is available.
    payload.access_token_encrypted = accessToken;
  }

  const { data: existing } = await supabase
    .from("whatsapp_connections")
    .select("id")
    .eq("organization_id", currentOrganizationId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("whatsapp_connections")
      .update(payload)
      .eq("id", existing.id)
      .eq("organization_id", currentOrganizationId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("whatsapp_connections").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/whatsapp-connection");
  redirect("/whatsapp-connection?saved=1");
}
