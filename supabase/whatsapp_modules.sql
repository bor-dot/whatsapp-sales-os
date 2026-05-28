-- WhatsApp Sales OS optional production modules.
-- Run in Supabase SQL editor after reviewing policies for your project.

create extension if not exists pgcrypto;

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
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

create index if not exists whatsapp_messages_owner_created_idx
  on public.whatsapp_messages(owner_id, created_at desc);
create index if not exists whatsapp_messages_customer_idx
  on public.whatsapp_messages(customer_id, created_at desc);
create index if not exists whatsapp_messages_normalized_phone_idx
  on public.whatsapp_messages(normalized_phone);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
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

create index if not exists appointments_owner_starts_idx
  on public.appointments(owner_id, starts_at);
create index if not exists appointments_customer_idx
  on public.appointments(customer_id);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('confirmation', 'reminder', 'campaign', 'aftercare')),
  body text not null,
  variables text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists message_templates_owner_category_idx
  on public.message_templates(owner_id, category);

create table if not exists public.whatsapp_send_queue (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
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

create index if not exists whatsapp_send_queue_owner_status_idx
  on public.whatsapp_send_queue(owner_id, status, scheduled_at);
create index if not exists whatsapp_send_queue_meta_message_idx
  on public.whatsapp_send_queue(meta_message_id);

create table if not exists public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'whatsapp',
  event_id text,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_webhook_events_created_idx
  on public.whatsapp_webhook_events(created_at desc);

alter table public.whatsapp_messages enable row level security;
alter table public.appointments enable row level security;
alter table public.message_templates enable row level security;
alter table public.whatsapp_send_queue enable row level security;
alter table public.whatsapp_webhook_events enable row level security;

create policy "Users can read own whatsapp messages"
  on public.whatsapp_messages for select
  using (auth.uid() = owner_id);

create policy "Users can read own appointments"
  on public.appointments for select
  using (auth.uid() = owner_id);

create policy "Users can manage own appointments"
  on public.appointments for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can read own message templates"
  on public.message_templates for select
  using (auth.uid() = owner_id);

create policy "Users can manage own message templates"
  on public.message_templates for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Users can read own send queue"
  on public.whatsapp_send_queue for select
  using (auth.uid() = owner_id);

create policy "Users can manage own send queue"
  on public.whatsapp_send_queue for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
