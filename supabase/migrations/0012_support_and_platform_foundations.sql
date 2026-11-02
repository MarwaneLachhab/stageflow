-- StageFlow 0012: support workspace foundation.
-- Safe to apply after the core workflow migrations.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'support_ticket_status') then
    create type public.support_ticket_status as enum ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
  end if;
  if not exists (select 1 from pg_type where typname = 'support_ticket_priority') then
    create type public.support_ticket_priority as enum ('LOW', 'NORMAL', 'HIGH', 'URGENT');
  end if;
end $$;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  category text not null default 'TECHNICAL',
  priority public.support_ticket_priority not null default 'NORMAL',
  status public.support_ticket_status not null default 'OPEN',
  description text not null,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint support_subject_len check (char_length(subject) between 3 and 160),
  constraint support_category_len check (char_length(category) between 2 and 40),
  constraint support_description_len check (char_length(description) between 10 and 5000)
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint support_message_len check (char_length(body) between 1 and 5000)
);

create index if not exists support_tickets_requester_idx on public.support_tickets (requester_id, updated_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, updated_at desc);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at before update on public.support_tickets
for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets for select to authenticated
using (requester_id = (select auth.uid()) or public.is_admin());

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets for insert to authenticated
with check (requester_id = (select auth.uid()));

drop policy if exists support_tickets_update on public.support_tickets;
create policy support_tickets_update on public.support_tickets for update to authenticated
using (requester_id = (select auth.uid()) or public.is_admin())
with check (requester_id = (select auth.uid()) or public.is_admin());

drop policy if exists support_messages_select on public.support_messages;
create policy support_messages_select on public.support_messages for select to authenticated
using (exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.requester_id = (select auth.uid()) or public.is_admin())));

drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages for insert to authenticated
with check (author_id = (select auth.uid()) and exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.requester_id = (select auth.uid()) or public.is_admin())));

grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;
