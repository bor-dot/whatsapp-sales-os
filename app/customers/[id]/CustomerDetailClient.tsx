"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { userFacingError } from "@/lib/user-facing-errors";

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

type CustomerLogRow = {
  id: string;
  log_type: string;
  content: string;
  created_at: string;
};

type CustomerLogType =
  | "status_change"
  | "note"
  | "follow_up"
  | "quote"
  | "appointment";

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

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function whatsappUrl(phone: string, whatsappPhone: string) {
  const digits = digitsOnly(whatsappPhone || phone);
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("90") ? digits : `90${digits.replace(/^0/, "")}`}`;
}

function logTypeText(type: string) {
  switch (type) {
    case "status_change":
      return "Durum değişikliği";
    case "note":
      return "Not";
    case "follow_up":
      return "Takip";
    case "quote":
      return "Teklif";
    case "appointment":
      return "Randevu";
    default:
      return type;
  }
}

type CustomerDetailClientProps = {
  customerId: string;
  organizationId: string;
  organizationName: string;
};

export default function CustomerDetailClient({
  customerId: routeCustomerId,
  organizationId,
  organizationName,
}: CustomerDetailClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [form, setForm] = useState<CustomerForm>(initialForm);
  const [savedForm, setSavedForm] = useState<CustomerForm>(initialForm);
  const [logs, setLogs] = useState<CustomerLogRow[]>([]);

  useEffect(() => {
    async function loadCustomer() {
      const id = routeCustomerId;

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

      setOwnerId(user.id);

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .single();

      if (error || !data) {
        setMessage("Müşteri bulunamadı.");
        setLoading(false);
        return;
      }

      setCustomerId(data.id);
      setCreatedAt(data.created_at ?? "");

      const loadedForm = {
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
      };

      setForm(loadedForm);
      setSavedForm(loadedForm);

      const { data: logRows } = await supabase
        .from("customer_logs")
        .select("id, log_type, content, created_at")
        .eq("customer_id", data.id)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(50);

      setLogs((logRows ?? []) as CustomerLogRow[]);

      setLoading(false);
    }

    loadCustomer();
  }, [organizationId, routeCustomerId, router, supabase]);

  function updateField<K extends keyof CustomerForm>(
    key: K,
    value: CustomerForm[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function reloadLogs(id = customerId) {
    if (!id) return;

    const { data } = await supabase
      .from("customer_logs")
      .select("id, log_type, content, created_at")
      .eq("customer_id", id)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50);

    setLogs((data ?? []) as CustomerLogRow[]);
  }

  async function writeLog(logType: CustomerLogType, content: string) {
    if (!customerId || !ownerId) return;

    await supabase.from("customer_logs").insert({
      customer_id: customerId,
      owner_id: ownerId,
      organization_id: organizationId,
      log_type: logType,
      content,
    });

    await reloadLogs();
  }

  function changedFieldSummary(nextForm: CustomerForm) {
    const labels: Record<keyof CustomerForm, string> = {
      full_name: "Ad soyad",
      phone: "Telefon",
      whatsapp_phone: "WhatsApp telefon",
      source: "Kaynak",
      service_interest: "İlgi alanı",
      status: "Durum",
      price_note: "Teklif notu",
      last_contact_at: "Son görüşme",
      next_follow_up_at: "Sonraki takip",
      notes: "Notlar",
    };

    return (Object.keys(labels) as Array<keyof CustomerForm>)
      .filter((key) => savedForm[key] !== nextForm[key])
      .map((key) => labels[key]);
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
      .eq("id", customerId)
      .eq("organization_id", organizationId);

    setSaving(false);

    if (error) {
      setMessage(userFacingError(error.message));
      return;
    }

    const nextForm = {
      ...form,
      full_name: payload.full_name,
      phone: payload.phone,
      whatsapp_phone: form.whatsapp_phone.trim(),
      source: form.source.trim(),
      service_interest: form.service_interest.trim(),
      price_note: form.price_note.trim(),
      notes: form.notes.trim(),
    };
    const changes = changedFieldSummary(nextForm);

    if (changes.length > 0) {
      await writeLog("note", `Müşteri bilgileri güncellendi: ${changes.join(", ")}.`);
    }

    setSavedForm(nextForm);
    setForm(nextForm);
    setMessage("Müşteri bilgileri güncellendi.");
    router.refresh();
  }

  async function handleQuickAction(
    payload: {
      status?: CustomerStatus;
      last_contact_at?: string | null;
      next_follow_up_at?: string | null;
    },
    successMessage: string,
    logContent: string,
    logType: CustomerLogType = "status_change",
  ) {
    if (!customerId) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", customerId)
      .eq("organization_id", organizationId);

    setSaving(false);

    if (error) {
      setMessage(userFacingError(error.message));
      return;
    }

    const nextForm = {
      ...form,
      ...(payload.status ? { status: payload.status } : {}),
      ...(payload.last_contact_at !== undefined
        ? { last_contact_at: toDatetimeLocal(payload.last_contact_at) }
        : {}),
      ...(payload.next_follow_up_at !== undefined
        ? { next_follow_up_at: toDatetimeLocal(payload.next_follow_up_at) }
        : {}),
    };

    setForm(nextForm);
    setSavedForm(nextForm);
    await writeLog(logType, logContent);
    setMessage(successMessage);
    router.refresh();
  }

  async function copyPhone() {
    const phone = form.whatsapp_phone || form.phone;
    if (!phone) return;

    try {
      await navigator.clipboard.writeText(phone);
      setMessage("Telefon panoya kopyalandı.");
    } catch {
      setMessage("Telefon kopyalanamadı.");
    }
  }

  function quickFollowUpTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    handleQuickAction(
      {
        status: "waiting",
        next_follow_up_at: tomorrow.toISOString(),
      },
      "Yarın 10:00 için takip planlandı.",
      "Yarın 10:00 için takip planlandı.",
      "follow_up",
    );
  }

  async function handleDelete() {
    const ok = window.confirm(
      "Bu müşteriyi silmek istediğine emin misin? Bu işlem geri alınamaz.",
    );

    if (!ok) return;

    setDeleting(true);
    setMessage("");

    await writeLog("note", "Müşteri silindi.");

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId)
      .eq("organization_id", organizationId);

    setDeleting(false);

    if (error) {
      setMessage(userFacingError(error.message));
      return;
    }

    router.replace("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="h-4 w-40 rounded-full bg-white/10" />
            <div className="h-8 w-64 rounded-full bg-white/10" />
            <div className="h-24 rounded-2xl bg-white/5" />
          </div>
        </div>
      </main>
    );
  }

  const contactUrl = whatsappUrl(form.phone, form.whatsapp_phone);

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
              {organizationName} müşteri detay ve düzenleme ekranı
            </p>
          </div>

          <Link
            href="/"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium hover:bg-white/10"
          >
            Geri Dön
          </Link>
        </div>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4 flex flex-col gap-1">
            <h2 className="text-lg font-semibold">Hızlı aksiyonlar</h2>
            <p className="text-sm text-zinc-400">
              Sık kullanılan satış adımlarını tek tıkla güncelle.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {contactUrl ? (
              <a
                href={contactUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/20"
              >
                WhatsApp’a Git
              </a>
            ) : null}

            <button
              type="button"
              disabled={saving}
              onClick={copyPhone}
              className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm font-medium hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Telefonu Kopyala
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                handleQuickAction(
                  { status: "contacted", last_contact_at: new Date().toISOString() },
                  "Bugün görüşüldü olarak işaretlendi.",
                  "Bugün görüşüldü olarak işaretlendi.",
                )
              }
              className="rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm font-medium hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Bugün Görüşüldü
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                handleQuickAction(
                  { status: "quoted" },
                  "Teklif verildi olarak işaretlendi.",
                  "Teklif verildi olarak işaretlendi.",
                  "quote",
                )
              }
              className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Teklif Verildi
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                handleQuickAction(
                  { status: "appointment" },
                  "Randevuya döndü olarak işaretlendi.",
                  "Randevuya döndü olarak işaretlendi.",
                  "appointment",
                )
              }
              className="rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-3 text-sm font-medium text-violet-100 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Randevuya Döndü
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={quickFollowUpTomorrow}
              className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm font-medium text-sky-100 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Yarın Takip
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() =>
                handleQuickAction(
                  { status: "lost" },
                  "Kaybedildi olarak işaretlendi.",
                  "Müşteri kaybedildi olarak işaretlendi.",
                )
              }
              className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Kaybedildi
            </button>
          </div>
        </section>

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

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-5">
            <h2 className="text-xl font-semibold">Müşteri geçmişi</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Önemli müşteri hareketleri `customer_logs` tablosundan gösterilir.
            </p>
          </div>

          <div className="space-y-3">
            {logs.length > 0 ? (
              logs.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-white">
                      {logTypeText(item.log_type)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{item.content}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 text-sm text-zinc-400">
                Bu müşteri için henüz log yok. İlk hızlı aksiyon veya düzenleme
                sonrası burada görünecek.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
