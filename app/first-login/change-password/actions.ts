"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function redirectWithError(message: string): never {
  const params = new URLSearchParams({ error: message });
  redirect(`/first-login/change-password?${params.toString()}`);
}

export async function changeFirstLoginPassword(formData: FormData) {
  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirectWithError("Tüm şifre alanları zorunlu.");
  }

  if (newPassword.length < 8) {
    redirectWithError("Yeni şifre en az 8 karakter olmalı.");
  }

  if (newPassword !== confirmPassword) {
    redirectWithError("Yeni şifre ve tekrar alanı eşleşmiyor.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    redirectWithError("Mevcut geçici şifre doğru değil.");
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (passwordError) {
    redirectWithError(passwordError.message);
  }

  const supabaseAdmin = createAdminClient();

  if (!supabaseAdmin) {
    redirectWithError("Servis anahtarı eksik olduğu için profil güncellenemedi.");
  }

  const { error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .update({
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (profileError) {
    redirectWithError(profileError.message);
  }

  redirect("/");
}
