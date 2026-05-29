import type { User } from "@supabase/supabase-js";

export type UserRole = "user" | "super_admin";

export type UserProfile = {
  user_id: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
};

export function defaultUserProfile(user: Pick<User, "id" | "user_metadata">): UserProfile {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  return {
    user_id: user.id,
    full_name: fullName,
    role: "user",
    is_active: true,
    must_change_password: false,
  };
}

export function normalizeUserProfile(
  user: Pick<User, "id" | "user_metadata">,
  profile: Partial<UserProfile> | null | undefined,
): UserProfile {
  const fallback = defaultUserProfile(user);

  return {
    user_id: profile?.user_id ?? fallback.user_id,
    full_name: profile?.full_name ?? fallback.full_name,
    role: profile?.role === "super_admin" ? "super_admin" : "user",
    is_active: profile?.is_active ?? fallback.is_active,
    must_change_password:
      profile?.must_change_password ?? fallback.must_change_password,
  };
}

export function isSuperAdmin(profile: UserProfile | null | undefined) {
  return profile?.role === "super_admin" && profile.is_active;
}
