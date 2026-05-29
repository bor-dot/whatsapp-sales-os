"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminClient, requireSuperAdmin } from "@/lib/admin-guards";
import { slugifyOrganizationName } from "@/lib/admin-onboarding";

function cleanText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function cleanEmail(value: FormDataEntryValue | null) {
  return cleanText(value).toLocaleLowerCase("tr");
}

function redirectWithMessage(path: string, key: "error" | "success", message: string): never {
  const params = new URLSearchParams({ [key]: message });
  redirect(`${path}?${params.toString()}`);
}

function validatePassword(password: string) {
  if (password.length < 8) {
    return "Geçici şifre en az 8 karakter olmalı.";
  }

  return null;
}

export async function createOrganizationWithOwner(formData: FormData) {
  await requireSuperAdmin();
  const supabaseAdmin = requireAdminClient();

  const organizationName = cleanText(formData.get("organization_name"));
  const slug = slugifyOrganizationName(
    cleanText(formData.get("slug")) || organizationName,
  );
  const ownerName = cleanText(formData.get("owner_name"));
  const ownerEmail = cleanEmail(formData.get("owner_email"));
  const temporaryPassword = cleanText(formData.get("temporary_password"));

  if (!organizationName || !slug || !ownerName || !ownerEmail || !temporaryPassword) {
    redirectWithMessage(
      "/admin/organizations/new",
      "error",
      "Merkez, yetkili kullanıcı ve geçici şifre alanları zorunlu.",
    );
  }

  const passwordError = validatePassword(temporaryPassword);

  if (passwordError) {
    redirectWithMessage("/admin/organizations/new", "error", passwordError);
  }

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: organizationName,
      slug,
      is_active: true,
    })
    .select("id")
    .single();

  if (organizationError || !organization) {
    redirectWithMessage(
      "/admin/organizations/new",
      "error",
      organizationError?.message ?? "Merkez oluşturulamadı.",
    );
  }

  const { data: authUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email: ownerEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: ownerName,
      },
    });

  if (authError || !authUser.user) {
    await supabaseAdmin.from("organizations").delete().eq("id", organization.id);
    redirectWithMessage(
      "/admin/organizations/new",
      "error",
      authError?.message ?? "Yetkili kullanıcı oluşturulamadı.",
    );
  }

  const userId = authUser.user.id;
  const { error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
        full_name: ownerName,
        role: "user",
        is_active: true,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (profileError) {
    redirectWithMessage(
      `/admin/organizations/${organization.id}`,
      "error",
      profileError.message,
    );
  }

  const { error: memberError } = await supabaseAdmin
    .from("organization_members")
    .insert({
      organization_id: organization.id,
      user_id: userId,
      role: "owner",
    });

  if (memberError) {
    redirectWithMessage(
      `/admin/organizations/${organization.id}`,
      "error",
      memberError.message,
    );
  }

  revalidatePath("/admin/organizations");
  redirect(`/admin/organizations/${organization.id}?success=Merkez oluşturuldu.`);
}

export async function updateOrganization(formData: FormData) {
  await requireSuperAdmin();
  const supabaseAdmin = requireAdminClient();

  const organizationId = cleanText(formData.get("organization_id"));
  const organizationName = cleanText(formData.get("organization_name"));
  const slug = slugifyOrganizationName(
    cleanText(formData.get("slug")) || organizationName,
  );
  const isActive = formData.get("is_active") === "on";

  if (!organizationId || !organizationName || !slug) {
    redirectWithMessage(
      `/admin/organizations/${organizationId}`,
      "error",
      "Merkez adı ve slug zorunlu.",
    );
  }

  const { error } = await supabaseAdmin
    .from("organizations")
    .update({
      name: organizationName,
      slug,
      is_active: isActive,
    })
    .eq("id", organizationId);

  if (error) {
    redirectWithMessage(`/admin/organizations/${organizationId}`, "error", error.message);
  }

  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${organizationId}`);
  redirectWithMessage(
    `/admin/organizations/${organizationId}`,
    "success",
    "Merkez güncellendi.",
  );
}

export async function createOrganizationUser(formData: FormData) {
  await requireSuperAdmin();
  const supabaseAdmin = requireAdminClient();

  const organizationId = cleanText(formData.get("organization_id"));
  const fullName = cleanText(formData.get("full_name"));
  const email = cleanEmail(formData.get("email"));
  const temporaryPassword = cleanText(formData.get("temporary_password"));
  const memberRole = cleanText(formData.get("member_role")) === "owner" ? "owner" : "member";

  if (!organizationId || !fullName || !email || !temporaryPassword) {
    redirectWithMessage(
      `/admin/organizations/${organizationId}`,
      "error",
      "Kullanıcı adı, e-posta ve geçici şifre zorunlu.",
    );
  }

  const passwordError = validatePassword(temporaryPassword);

  if (passwordError) {
    redirectWithMessage(`/admin/organizations/${organizationId}`, "error", passwordError);
  }

  const { data: authUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

  if (authError || !authUser.user) {
    redirectWithMessage(
      `/admin/organizations/${organizationId}`,
      "error",
      authError?.message ?? "Kullanıcı oluşturulamadı.",
    );
  }

  const userId = authUser.user.id;
  const { error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
        full_name: fullName,
        role: "user",
        is_active: true,
        must_change_password: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (profileError) {
    redirectWithMessage(`/admin/organizations/${organizationId}`, "error", profileError.message);
  }

  const { error: memberError } = await supabaseAdmin
    .from("organization_members")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      role: memberRole,
    });

  if (memberError) {
    redirectWithMessage(`/admin/organizations/${organizationId}`, "error", memberError.message);
  }

  revalidatePath(`/admin/organizations/${organizationId}`);
  redirectWithMessage(
    `/admin/organizations/${organizationId}`,
    "success",
    "Kullanıcı oluşturuldu.",
  );
}

export async function updateOrganizationMember(formData: FormData) {
  await requireSuperAdmin();
  const supabaseAdmin = requireAdminClient();

  const organizationId = cleanText(formData.get("organization_id"));
  const userId = cleanText(formData.get("user_id"));
  const memberRole = cleanText(formData.get("member_role")) === "owner" ? "owner" : "member";
  const isActive = formData.get("is_active") === "on";

  if (!organizationId || !userId) {
    redirectWithMessage("/admin/organizations", "error", "Kullanıcı bulunamadı.");
  }

  const [{ error: memberError }, { error: profileError }] = await Promise.all([
    supabaseAdmin
      .from("organization_members")
      .update({ role: memberRole })
      .eq("organization_id", organizationId)
      .eq("user_id", userId),
    supabaseAdmin
      .from("user_profiles")
      .upsert(
        {
          user_id: userId,
          is_active: isActive,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      ),
  ]);

  if (memberError || profileError) {
    redirectWithMessage(
      `/admin/organizations/${organizationId}`,
      "error",
      memberError?.message ?? profileError?.message ?? "Kullanıcı güncellenemedi.",
    );
  }

  revalidatePath(`/admin/organizations/${organizationId}`);
  redirectWithMessage(
    `/admin/organizations/${organizationId}`,
    "success",
    "Kullanıcı güncellendi.",
  );
}
