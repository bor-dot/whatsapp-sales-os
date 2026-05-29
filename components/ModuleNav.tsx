import Link from "next/link";
import type { ReactNode } from "react";
import { getOrganizationContext } from "@/lib/organizations";
import { OrganizationSwitcher } from "@/components/OrganizationSwitcher";

const links = [
  { href: "/", label: "Panel" },
  { href: "/modules", label: "Modüller" },
  { href: "/contacts", label: "Kişiler" },
  { href: "/conversations", label: "Konuşmalar" },
  { href: "/appointments", label: "Randevular" },
  { href: "/templates", label: "Şablonlar" },
  { href: "/send-queue", label: "Mesaj Kuyruğu" },
  { href: "/whatsapp-connection", label: "WhatsApp Bağlantısı" },
];

export async function ModuleNav({ currentPath = "/" }: { currentPath?: string }) {
  const context = await getOrganizationContext();

  return (
    <div className="mb-6 flex flex-col gap-4">
      <OrganizationSwitcher
        organizations={context.organizations}
        currentOrganizationId={context.currentOrganizationId}
        currentPath={currentPath}
      />
      <nav className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-white/10"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function SetupNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
      {children}
    </div>
  );
}
