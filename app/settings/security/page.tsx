import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ModuleNav } from "@/components/ModuleNav";
import { SecurityForm } from "@/app/settings/security/SecurityForm";
import { getOrganizationContext } from "@/lib/organizations";

export const metadata: Metadata = {
  title: "Güvenlik",
};

export default async function SecurityPage() {
  const { user } = await getOrganizationContext();

  if (!user?.email) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <ModuleNav currentPath="/settings/security" />
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-zinc-400">Hesap</p>
          <h1 className="mt-1 text-3xl font-semibold">Güvenlik</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Hesabının şifresini buradan güncelleyebilirsin.
          </p>
          <SecurityForm email={user.email} />
        </section>
      </div>
    </main>
  );
}
