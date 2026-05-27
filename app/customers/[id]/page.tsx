"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CustomerStatus =
  | "new"
  | "contacted"
  | "quoted"
  | "waiting"
  | "appointment"
  | "won"
  | "lost";

type CustomerForm = {
  full_name: string;
  phone: string;
  whatsapp_phone: string;
  source: string;
  service_interest: string;
  status: CustomerStatus;
  price_note: string;
  last_contact_at: string;
  next_follow_up_at: string;
  notes: string;
};

const initialForm: CustomerForm = {
  full_name: "",
  phone: "",
  whatsapp_phone: "",
  source: "",
  service_interest: "",
  status: "new",
  price_note: "",
  last_contact_at: "",
  next_follow_up_at: "",
  notes: "",
};

function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [form, setForm] = useState<CustomerForm>(initialForm);

  useEffect(() => {
    async function loadCustomer() {
      const id = params?.id;

      if (!id) {
        setMessage("Müşteri bulunamadı.");
        setLoading(false);
        return;
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        setMessage("Müşteri bulunamadı.");
        setLoading(false);
        return;
      }

      setCustomerId(data.id);
      setCreatedAt(data.created_at ?? "");

      setForm({
        full_name: data.full_name ?? "",
        phone: data.phone ?? "",
        whatsapp_phone: data.whatsapp_phone ?? "",
        source: data.source ?? "",
        service_interest: data.service_interest ?? "",
        status: (data.status as CustomerStatus) ?? "new",
        price_note: data.price_note ?? "",
        last_contact_at: toDatetimeLocal(data.last_contact_at),
        next_follow_up_at: toDatetimeLocal(data.next_follow_up_at),
        notes: data.notes ?? "",
      });

      setLoading(false);
    }

    loadCustomer();
  }, [params, router, supabase]);

  function updateField<K extends keyof CustomerForm>(
    key: K,
    value: CustomerForm[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      whatsapp_phone: form.whatsapp_phone.trim() || null,
      source: form.source.trim() || null,
      service_interest: form.service_interest.trim() || null,
      status: form.status,
      price_note: form.price_note.trim() || null,
      last_contact_at: form.last_contact_at
        ? new Date(form.last_contact_at).toISOString()
        : null,
      next_follow_up_at: form.next_follow_up_at
        ? new Date(form.next_follow_up_at).toISOString()
        : null,
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", customerId);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Müşteri bilgileri güncellendi.");
    router.refresh();
  }

  async function handleDelete() {
    const ok = window.confirm(
      "Bu müşteriyi silmek istediğine emin misin? Bu işlem geri alınamaz.",
    );

    if (!ok) return;

    setDeleting(true);
    setMessage("");

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId);

    setDeleting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            Yükleniyor...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">WhatsApp Sales OS</p>
            <h1 className="mt-1 text-3xl font-semibold">
              {form.full_name || "Müşteri"}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Müşteri detay ve düzenleme ekranı
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
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
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
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
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
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
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
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
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
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="status" className="text-sm text-zinc-300">
                Durum
              </label>
              <select
                id="status"
                value={form.status}
                onChange={(e) =>
                  updateField("status", e.target.value as CustomerStatus)
                }
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
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="last_contact_at" className="text-sm text-zinc-300">
                Son Görüşme
              </label>
              <input
                id="last_contact_at"
                type="datetime-local"
                value={form.last_contact_at}
                onChange={(e) => updateField("last_contact_at", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="next_follow_up_at" className="text-sm text-zinc-300">
                Sonraki Takip
              </label>
              <input
                id="next_follow_up_at"
                type="datetime-local"
                value={form.next_follow_up_at}
                onChange={(e) =>
                  updateField("next_follow_up_at", e.target.value)
                }
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="notes" className="text-sm text-zinc-300">
                Notlar
              </label>
              <textarea
                id="notes"
                rows={6}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-pink-400/40"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 text-sm">
              <p className="text-zinc-400">Oluşturulma</p>
              <p className="mt-1">{formatDate(createdAt)}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4 text-sm">
              <p className="text-zinc-400">Müşteri ID</p>
              <p className="mt-1 break-all">{customerId}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-pink-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-2xl border border-red-400/30 bg-red-500/10 px-5 py-3 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Siliniyor..." : "Müşteriyi Sil"}
            </button>

            <Link
              href="/"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium hover:bg-white/10"
            >
              Ana Sayfa
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}