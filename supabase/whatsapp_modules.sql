-- WhatsApp Sales OS optional production modules.
-- Run in Supabase SQL editor after reviewing policies for your project.
-- This migration is organization-aware. Existing owner_id columns are kept only
-- for backwards compatibility; application reads and writes use organization_id.

create extension if not exists pgcrypto;

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  wa_message_id text unique,
  from_phone text,
  to_phone text,
  normalized_phone text,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_type text not null default 'text',
  body text,
  status text,
  payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  starts_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  reminder_status text not null default 'pending'
    check (reminder_status in ('pending', 'queued', 'sent', 'failed', 'skipped')),
  confirmation_status text not null default 'pending'
    check (confirmation_status in ('pending', 'queued', 'confirmed', 'declined', 'failed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null check (category in ('confirmation', 'reminder', 'campaign', 'aftercare')),
  body text not null,
  variables text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_send_queue (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  template_id uuid references public.message_templates(id) on delete set null,
  to_phone text not null,
  message_body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  delivery_status text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  attempt_count integer not null default 0,
  error_message text,
  meta_message_id text,
  meta_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  provider text not null default 'whatsapp',
  event_id text,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  display_phone_number text,
  phone_number_id text,
  business_account_id text,
  verify_token text,
  access_token_encrypted text,
  is_connected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_messages
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.appointments
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.message_templates
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.whatsapp_send_queue
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.whatsapp_webhook_events
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;
alter table public.whatsapp_connections
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;

create index if not exists whatsapp_messages_org_created_idx
  on public.whatsapp_messages(organization_id, created_at desc);
create index if not exists whatsapp_messages_customer_idx
  on public.whatsapp_messages(customer_id, created_at desc);
create index if not exists whatsapp_messages_org_phone_idx
  on public.whatsapp_messages(organization_id, normalized_phone);

create index if not exists appointments_org_starts_idx
  on public.appointments(organization_id, starts_at);
create index if not exists appointments_customer_idx
  on public.appointments(customer_id);

create index if not exists message_templates_org_category_idx
  on public.message_templates(organization_id, category);

create index if not exists whatsapp_send_queue_org_status_idx
  on public.whatsapp_send_queue(organization_id, status, scheduled_at);
create index if not exists whatsapp_send_queue_meta_message_idx
  on public.whatsapp_send_queue(meta_message_id);

create index if not exists whatsapp_webhook_events_org_created_idx
  on public.whatsapp_webhook_events(organization_id, created_at desc);

create unique index if not exists whatsapp_connections_org_unique_idx
  on public.whatsapp_connections(organization_id);
create index if not exists whatsapp_connections_phone_number_idx
  on public.whatsapp_connections(phone_number_id);
create index if not exists whatsapp_connections_verify_token_idx
  on public.whatsapp_connections(verify_token);

create index if not exists customers_org_created_idx
  on public.customers(organization_id, created_at desc);
create index if not exists customer_logs_org_created_idx
  on public.customer_logs(organization_id, created_at desc);

alter table public.whatsapp_messages enable row level security;
alter table public.appointments enable row level security;
alter table public.message_templates enable row level security;
alter table public.whatsapp_send_queue enable row level security;
alter table public.whatsapp_webhook_events enable row level security;
alter table public.whatsapp_connections enable row level security;

drop policy if exists "Org members can read whatsapp messages" on public.whatsapp_messages;
create policy "Org members can read whatsapp messages"
  on public.whatsapp_messages for select
  using (
    exists (
      select 1
      from public.organization_members members
      where members.organization_id = whatsapp_messages.organization_id
        and members.user_id = auth.uid()
    )
  );

drop policy if exists "Org members can manage appointments" on public.appointments;
create policy "Org members can manage appointments"
  on public.appointments for all
  using (
    exists (
      select 1
      from public.organization_members members
      where members.organization_id = appointments.organization_id
        and members.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members members
      where members.organization_id = appointments.organization_id
        and members.user_id = auth.uid()
    )
  );

drop policy if exists "Org members can manage message templates" on public.message_templates;
create policy "Org members can manage message templates"
  on public.message_templates for all
  using (
    exists (
      select 1
      from public.organization_members members
      where members.organization_id = message_templates.organization_id
        and members.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members members
      where members.organization_id = message_templates.organization_id
        and members.user_id = auth.uid()
    )
  );

drop policy if exists "Org members can read send queue" on public.whatsapp_send_queue;
create policy "Org members can read send queue"
  on public.whatsapp_send_queue for select
  using (
    exists (
      select 1
      from public.organization_members members
      where members.organization_id = whatsapp_send_queue.organization_id
        and members.user_id = auth.uid()
    )
  );

drop policy if exists "Org members can read webhook events" on public.whatsapp_webhook_events;
create policy "Org members can read webhook events"
  on public.whatsapp_webhook_events for select
  using (
    organization_id is not null
    and exists (
      select 1
      from public.organization_members members
      where members.organization_id = whatsapp_webhook_events.organization_id
        and members.user_id = auth.uid()
    )
  );

drop policy if exists "Org members can manage whatsapp connections" on public.whatsapp_connections;
create policy "Org members can manage whatsapp connections"
  on public.whatsapp_connections for all
  using (
    exists (
      select 1
      from public.organization_members members
      where members.organization_id = whatsapp_connections.organization_id
        and members.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.organization_members members
      where members.organization_id = whatsapp_connections.organization_id
        and members.user_id = auth.uid()
    )
  );
