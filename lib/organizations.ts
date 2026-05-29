import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeUserProfile, type UserProfile } from "@/lib/user-profiles";

export const ACTIVE_ORGANIZATION_COOKIE = "wso_active_organization_id";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string | null;
  is_active: boolean;
  role: string;
};

type OrganizationMemberRow = {
  organization_id: string;
  role: string | null;
  organizations:
    | {
        id: string;
        name: string;
        slug: string | null;
        is_active?: boolean | null;
      }
    | {
        id: string;
        name: string;
        slug: string | null;
        is_active?: boolean | null;
      }[]
    | null;
};

function shouldBypassPasswordGate(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/first-login/change-password") ||
    pathname.startsWith("/auth")
  );
}

export async function getOrganizationContext() {
  const supabase = await createClient();
  const headerStore = await headers();
  const pathname = headerStore.get("x-current-path") ?? "/";
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      organizations: [] as OrganizationSummary[],
      currentOrganization: null,
      currentOrganizationId: null,
      needsOrganizationSelection: false,
      profile: null as UserProfile | null,
    };
  }

  const { data: rawProfile } = await supabase
    .from("user_profiles")
    .select("user_id, full_name, role, is_active, must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = normalizeUserProfile(user, rawProfile);

  if (!profile.is_active) {
    redirect("/login");
  }

  if (profile.must_change_password && !shouldBypassPasswordGate(pathname)) {
    redirect("/first-login/change-password");
  }

  const membershipResult = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, slug, is_active)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  let data: unknown[] | null = membershipResult.data;

  if (!data) {
    const fallback = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(id, name, slug)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    data = fallback.data as unknown[] | null;
  }
  const organizations = ((data ?? []) as OrganizationMemberRow[])
    .map((membership) => {
      const organization = Array.isArray(membership.organizations)
        ? membership.organizations[0]
        : membership.organizations;

      if (!organization) return null;

      return {
        id: membership.organization_id,
        name: organization.name,
        slug: organization.slug,
        is_active: organization.is_active ?? true,
        role: membership.role ?? "member",
      };
    })
    .filter((organization) => organization?.is_active) as OrganizationSummary[];
  const cookieStore = await cookies();
  const selectedOrganizationId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const selectedOrganization =
    organizations.find((organization) => organization.id === selectedOrganizationId) ?? null;
  const currentOrganization =
    selectedOrganization ?? (organizations.length === 1 ? organizations[0] : null);

  return {
    user,
    organizations,
    currentOrganization,
    currentOrganizationId: currentOrganization?.id ?? null,
    needsOrganizationSelection: organizations.length > 1 && !selectedOrganization,
    profile,
  };
}

export async function currentOrganizationId() {
  const context = await getOrganizationContext();

  return context.currentOrganizationId;
}
