"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CustomerStatus =
  | "new"
  | "contacted"
  | "quoted"
  | "waiting"
  | "appointment"
  | "won"
  | "lost";

type FormState = {
  full_name: string;
  phone: string;
  whatsapp_phone: string;
  source: string;
  service_interest: string;
  status: CustomerStatus;
  price_note: string;
  next_follow_up_at: string;
  notes: string;
};

const initialState: FormState = {
  full_name: "",
  phone: "",
  whatsapp_phone: "",
  source: "",
  service_interest: "",
  status: "new",
  price_note: "",
  next_follow_up_at: "",
  notes: "",
};

type NewCustomerClientProps = {
  organizationId: string;
  organizationName: string;
};

export default function NewCustomerClient({
  organizationId,
  organizationName,
}: NewCustomerClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<FormState>(initialState);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSaving(false);
      setMessage("Oturum bulunamadı. Tekrar giriş yap.");
      router.replace("/login");
      return;
    }

    const payload = {
      owner_id: user.id,
      organization_id: organizationId,
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      whatsapp_phone: form.whatsapp_phone.trim() || null,
      source: form.source.trim() || null,
      service_interest: form.service_interest.trim() || null,
      status: form.status,
      price_note: form.price_note.trim() || null,
      next_follow_up_at: form.next_follow_up_at
        ? new Date(form.next_follow_up_at).toISOString()
        : null,
      notes: form.notes.trim() || null,
    };

    const { data: customer, error } = await supabase
      .from("customers")
      .insert(payload)
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (customer?.id) {
      await supabase.from("customer_logs").insert({
        customer_id: customer.id,
        owner_id: user.id,
        organization_id: organizationId,
        log_type: "note",
        content: "Müşteri kaydı oluşturuldu.",
      });
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">WhatsApp Sales OS</p>
            <h1 className="mt-1 text-3xl font-semibold">Yeni Müşteri Ekle</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {organizationName} için potansiyel müşteriyi kaydet, sonra takip et.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10"
          >
            Geri Dön
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          {message ? (
            <div className="rounded-2xl border border-pink-400/30 bg-pink-500/10 px-4 py-3 text-sm text-pink-100">
              {message}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="full_name" className="text-sm text-zinc-300">
                Ad Soyad
              </label>
              <input
                id="full_name"
                value={form.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                placeholder="Örn: Ayşe Yılmaz"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm text-zinc-300">
                Telefon
              </label>
              <input
                id="phone"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                placeholder="05xx xxx xx xx"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="whatsapp_phone" className="text-sm text-zinc-300">
                WhatsApp Telefon
              </label>
              <input
                id="whatsapp_phone"
                value={form.whatsapp_phone}
                onChange={(e) => updateField("whatsapp_phone", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                placeholder="Boş bırakılabilir"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="source" className="text-sm text-zinc-300">
                Kaynak
              </label>
              <input
                id="source"
                value={form.source}
                onChange={(e) => updateField("source", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                placeholder="Instagram, reklam, tavsiye..."
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="service_interest" className="text-sm text-zinc-300">
                İlgi Alanı
              </label>
              <input
                id="service_interest"
                value={form.service_interest}
                onChange={(e) => updateField("service_interest", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                placeholder="Lazer epilasyon, cilt bakımı..."
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="status" className="text-sm text-zinc-300">
                Durum
              </label>
              <select
                id="status"
                value={form.status}
                onChange={(e) => updateField("status", e.target.value as CustomerStatus)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
              >
                <option value="new">Yeni</option>
                <option value="contacted">Görüşüldü</option>
                <option value="quoted">Teklif</option>
                <option value="waiting">Bekliyor</option>
                <option value="appointment">Randevu</option>
                <option value="won">Kazanıldı</option>
                <option value="lost">Kaybedildi</option>
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="price_note" className="text-sm text-zinc-300">
                Fiyat / Teklif Notu
              </label>
              <input
                id="price_note"
                value={form.price_note}
                onChange={(e) => updateField("price_note", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                placeholder="Örn: 6 seans için 12.000 TL teklif verildi"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="next_follow_up_at" className="text-sm text-zinc-300">
                Sonraki Takip Tarihi
              </label>
              <input
                id="next_follow_up_at"
                type="datetime-local"
                value={form.next_follow_up_at}
                onChange={(e) => updateField("next_follow_up_at", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="notes" className="text-sm text-zinc-300">
                Notlar
              </label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={5}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-pink-400/40"
                placeholder="Müşteri notu, özel bilgi, istekler..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-pink-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Kaydediliyor..." : "Müşteriyi Kaydet"}
            </button>

            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium hover:bg-white/10"
            >
              Vazgeç
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
