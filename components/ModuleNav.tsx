import Link from "next/link";
import type { ReactNode } from "react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/modules", label: "Modüller" },
  { href: "/contacts", label: "Contacts" },
  { href: "/conversations", label: "Conversations" },
  { href: "/appointments", label: "Appointments" },
  { href: "/templates", label: "Templates" },
  { href: "/send-queue", label: "Send Queue" },
];

export function ModuleNav() {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
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
  );
}

export function SetupNotice({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5 text-sm leading-6 text-amber-100">
      {children}
    </div>
  );
}
