import { redirect } from "next/navigation";
import { ModuleNav } from "@/components/ModuleNav";
import { OrganizationRequired } from "@/components/OrganizationSwitcher";
import { getOrganizationContext } from "@/lib/organizations";
import NewCustomerClient from "./NewCustomerClient";

export default async function NewCustomerPage() {
  const { user, currentOrganization, currentOrganizationId } =
    await getOrganizationContext();

  if (!user) {
    redirect("/login");
  }

  if (!currentOrganizationId || !currentOrganization) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <ModuleNav currentPath="/customers/new" />
          <OrganizationRequired />
        </div>
      </main>
    );
  }

  return (
    <NewCustomerClient
      organizationId={currentOrganizationId}
      organizationName={currentOrganization.name}
    />
  );
}
