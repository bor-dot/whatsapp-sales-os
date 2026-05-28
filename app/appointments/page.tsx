import Link from "next/link";
import { redirect } from "next/navigation";
import { ModuleNav, SetupNotice } from "@/components/ModuleNav";
import { OrganizationRequired } from "@/components/OrganizationSwitcher";
import { getOrganizationContext } from "@/lib/organizations";
import { isMissingTableError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";

type AppointmentRow = {
  id: string;
  customer_id: string | null;
  starts_at: string;
  status: string;
  reminder_status: string | null;
  confirmation_status: string | null;
  notes: string | null;
};

type CustomerSignal = {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  next_follow_up_at: string | null;
};

type CustomerLookup = {
  id: string;
  full_name: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AppointmentsPage() {
  const supabase = await createClient();
  const { user, currentOrganization, currentOrganizationId } =
    await getOrganizationContext();

  if (!user) {
    redirect("/login");
  }

  if (!currentOrganizationId) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <ModuleNav currentPath="/appointments" />
          <OrganizationRequired />
        </div>
      </main>
    );
  }

  const appointmentResult = await supabase
    .from("appointments")
    .select(
      "id, customer_id, starts_at, status, reminder_status, confirmation_status, notes",
    )
    .eq("organization_id", currentOrganizationId)
    .order("starts_at", { ascending: true })
    .limit(100);

  const setupRequired = isMissingTableError(appointmentResult.error);

  if (appointmentResult.error && !setupRequired) {
    throw new Error(appointmentResult.error.message);
  }

  const appointments = setupRequired
    ? []
    : ((appointmentResult.data ?? []) as AppointmentRow[]);
  const customerIds = Array.from(
    new Set(appointments.map((appointment) => appointment.customer_id).filter(Boolean)),
  ) as string[];
  const { data: appointmentCustomers } = customerIds.length
    ? await supabase
        .from("customers")
        .select("id, full_name")
        .eq("organization_id", currentOrganizationId)
        .in("id", customerIds)
    : { data: [] };
  const customerLookup = new Map(
    ((appointmentCustomers ?? []) as CustomerLookup[]).map((customer) => [
      customer.id,
      customer.full_name,
    ]),
  );

  const { data: signals } = await supabase
    .from("customers")
    .select("id, full_name, phone, status, next_follow_up_at")
    .eq("organization_id", currentOrganizationId)
    .or("status.eq.appointment,next_follow_up_at.not.is.null")
    .order("next_follow_up_at", { ascending: true })
    .limit(50);
  const crmSignals = (signals ?? []) as CustomerSignal[];
  const pendingReminderCount = appointments.filter(
    (appointment) => appointment.reminder_status !== "queued",
  ).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ModuleNav currentPath="/appointments" />

        <header className="mb-8 rounded-3xl border border-white/10 bg-white/5 p-6">
          <p className="text-sm text-zinc-400">Appointments</p>
          <h1 className="mt-2 text-3xl font-semibold">Randevu ve reminder takip</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {currentOrganization?.name} randevuları teyit ve hatırlatma şablonlarıyla
            send queue’ya düşer.
          </p>
        </header>

        {setupRequired ? (
          <SetupNotice>
            <strong>Randevu tablosu eksik.</strong> `appointments` ve `whatsapp_send_queue`
            tabloları kurulduktan sonra <span className="text-white">/api/appointments/reminders</span>{" "}
            worker’ı otomatik teyit ve hatırlatma mesajlarını kuyruğa alır.
          </SetupNotice>
        ) : null}

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm text-zinc-400">Randevu kaydı</p>
            <p className="mt-3 text-3xl font-semibold">{appointments.length}</p>
          </div>
          <div className="rounded-3xl border border-amber-400/20 bg-amber-500/10 p-5">
            <p className="text-sm text-amber-200/80">Reminder bekleyen</p>
            <p className="mt-3 text-3xl font-semibold text-amber-100">
              {pendingReminderCount}
            </p>
          </div>
          <div className="rounded-3xl border border-sky-400/20 bg-sky-500/10 p-5">
            <p className="text-sm text-sky-200/80">CRM takip sinyali</p>
            <p className="mt-3 text-3xl font-semibold text-sky-100">{crmSignals.length}</p>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Appointments tablosu</h2>
            <div className="mt-4 space-y-3">
              {appointments.length > 0 ? (
                appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-medium">
                        {appointment.customer_id ? (
                          <Link
                            href={`/customers/${appointment.customer_id}`}
                            className="text-pink-300 hover:text-pink-200 hover:underline"
                          >
                            {customerLookup.get(appointment.customer_id) ?? "Müşteri"}
                          </Link>
                        ) : (
                          "Eşleşmemiş randevu"
                        )}
                      </p>
                      <span className="text-sm text-zinc-400">
                        {formatDate(appointment.starts_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-400">
                      Durum: {appointment.status} · Teyit:{" "}
                      {appointment.confirmation_status ?? "-"} · Reminder:{" "}
                      {appointment.reminder_status ?? "-"}
                    </p>
                    {appointment.notes ? (
                      <p className="mt-2 text-sm text-zinc-300">{appointment.notes}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 text-sm text-zinc-400">
                  Henüz appointment kaydı yok.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">CRM takip sinyalleri</h2>
            <div className="mt-4 space-y-3">
              {crmSignals.length > 0 ? (
                crmSignals.map((customer) => (
                  <div
                    key={customer.id}
                    className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4"
                  >
                    <Link
                      href={`/customers/${customer.id}`}
                      className="font-medium text-pink-300 hover:text-pink-200 hover:underline"
                    >
                      {customer.full_name}
                    </Link>
                    <p className="mt-2 text-sm text-zinc-400">
                      {customer.phone} · {customer.status} ·{" "}
                      {formatDate(customer.next_follow_up_at)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6 text-sm text-zinc-400">
                  Randevu veya takip sinyali yok.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
