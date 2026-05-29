import { redirect } from "next/navigation";
import { isSuperAdmin, normalizeUserProfile } from "@/lib/user-profiles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id, full_name, role, is_active, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();

  const normalizedProfile = normalizeUserProfile(user, profile);

  if (!isSuperAdmin(normalizedProfile)) {
    redirect("/");
  }

  return { user, profile: normalizedProfile };
}

export function requireAdminClient() {
  const supabaseAdmin = createAdminClient();

  if (!supabaseAdmin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY eksik.");
  }

  return supabaseAdmin;
}
