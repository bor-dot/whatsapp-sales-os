import { redirect } from "next/navigation";
import { ModuleNav, SetupNotice } from "@/components/ModuleNav";
import { isMissingTableError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_MESSAGE_TEMPLATES } from "@/lib/whatsapp/templates";

type DbTemplate = {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[] | null;
  is_active: boolean;
};

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("message_templates")
    .select("id, name, category, body, variables, is_active")
    .order("created_at", { ascending: false })
    .limit(100);
  const setupRequired = isMissingTableError(error);

  if (error && !setupRequired) {
    throw new Error(error.message);
  }

  const dbTemplates = setupRequired ? [] : ((data ?? []) as DbTemplate[]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ModuleNav />

        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-zinc-400">Templates</p>
          <h1 className="mt-2 text-3xl font-semibold">WhatsApp mesaj şablonları</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Onay, hatırlatma, kampanya ve işlem sonrası mesaj metinleri.
          </p>
        </header>

        {setupRequired ? (
          <SetupNotice>
            <strong>message_templates tablosu yok.</strong> Aşağıdaki varsayılan
            şablonlar kod içinde hazır. SQL dosyası çalıştırıldığında ekip şablonları
            veritabanından yönetebilir.
          </SetupNotice>
        ) : null}

        <section className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Varsayılan şablonlar</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {DEFAULT_MESSAGE_TEMPLATES.map((template) => (
              <div
                key={template.key}
                className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-medium">{template.name}</h3>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                    {template.category}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{template.body}</p>
                <p className="mt-3 text-xs text-zinc-500">
                  Değişkenler: {template.variables.join(", ") || "-"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Veritabanı şablonları</h2>
          <div className="mt-4 space-y-3">
            {dbTemplates.length > 0 ? (
              dbTemplates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-medium">{template.name}</h3>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                      {template.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{template.body}</p>
                  <p className="mt-3 text-xs text-zinc-500">
                    {template.category} · {(template.variables ?? []).join(", ") || "-"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 text-sm text-zinc-400">
                Henüz veritabanı şablonu yok.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
