"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrganizationContext } from "@/lib/organizations";
import { createClient } from "@/lib/supabase/server";
import type { MetaProvider } from "@/lib/meta/connection";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function providerValue(value: FormDataEntryValue | null): MetaProvider {
  return value === "instagram" ? "instagram" : "facebook";
}

export async function saveMetaConnection(formData: FormData) {
  const { user, currentOrganizationId } = await getOrganizationContext();

  if (!user) {
    redirect("/login");
  }

  if (!currentOrganizationId) {
    redirect("/meta-connections");
  }

  const supabase = await createClient();
  const provider = providerValue(formData.get("provider"));
  const accessToken = textValue(formData, "access_token");
  const payload: Record<string, string | boolean | null> = {
    organization_id: currentOrganizationId,
    provider,
    display_name: textValue(formData, "display_name") || null,
    page_id: textValue(formData, "page_id") || null,
    instagram_business_account_id:
      textValue(formData, "instagram_business_account_id") || null,
    ad_account_id: textValue(formData, "ad_account_id") || null,
    verify_token: textValue(formData, "verify_token") || null,
    is_connected: formData.get("is_connected") === "on",
    updated_at: new Date().toISOString(),
  };

  if (accessToken) {
    // TODO: Replace plain storage with encryption/decryption when a KMS key is available.
    payload.access_token_encrypted = accessToken;
  }

  const { data: existing } = await supabase
    .from("meta_connections")
    .select("id")
    .eq("organization_id", currentOrganizationId)
    .eq("provider", provider)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("meta_connections")
      .update(payload)
      .eq("id", existing.id)
      .eq("organization_id", currentOrganizationId)
      .eq("provider", provider);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("meta_connections").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/meta-connections");
  redirect(`/meta-connections?saved=${provider}`);
}
