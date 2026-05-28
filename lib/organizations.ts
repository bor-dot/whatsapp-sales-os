import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_ORGANIZATION_COOKIE = "wso_active_organization_id";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string | null;
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
      }
    | {
        id: string;
        name: string;
        slug: string | null;
      }[]
    | null;
};

export async function getOrganizationContext() {
  const supabase = await createClient();
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
    };
  }

  const { data } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  const organizations = ((data ?? []) as unknown as OrganizationMemberRow[])
    .map((membership) => {
      const organization = Array.isArray(membership.organizations)
        ? membership.organizations[0]
        : membership.organizations;

      if (!organization) return null;

      return {
        id: membership.organization_id,
        name: organization.name,
        slug: organization.slug,
        role: membership.role ?? "member",
      };
    })
    .filter(Boolean) as OrganizationSummary[];
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
  };
}

export async function currentOrganizationId() {
  const context = await getOrganizationContext();

  return context.currentOrganizationId;
}
