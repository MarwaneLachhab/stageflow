-- StageFlow 0013: reusable organisations and public internship offers.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'ORGANIZATION',
  description text not null default '',
  logo_url text,
  website text,
  email text,
  phone text,
  address text,
  city text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organizations_name_len check (char_length(name) between 2 and 160),
  constraint organizations_kind_len check (char_length(kind) between 2 and 40),
  constraint organizations_description_len check (char_length(description) <= 5000)
);

create table if not exists public.internship_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text not null,
  domain text not null,
  stage_type text not null,
  mode text not null default 'Présentiel',
  city text,
  starts_on date,
  ends_on date,
  deadline date,
  capacity integer not null default 1,
  published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint offers_title_len check (char_length(title) between 3 and 180),
  constraint offers_description_len check (char_length(description) between 20 and 5000),
  constraint offers_domain_len check (char_length(domain) between 2 and 80),
  constraint offers_stage_type_len check (char_length(stage_type) between 2 and 80),
  constraint offers_capacity_valid check (capacity between 1 and 10000),
  constraint offers_dates_valid check (ends_on is null or starts_on is null or ends_on > starts_on)
);

create index if not exists organizations_active_idx on public.organizations (is_active, name);
create index if not exists offers_public_idx on public.internship_offers (published, deadline, created_at desc);
create index if not exists offers_organization_idx on public.internship_offers (organization_id, created_at desc);

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
drop trigger if exists offers_set_updated_at on public.internship_offers;
create trigger offers_set_updated_at before update on public.internship_offers
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.internship_offers enable row level security;

drop policy if exists organizations_public_select on public.organizations;
create policy organizations_public_select on public.organizations for select to anon, authenticated
using (is_active or public.is_admin());
drop policy if exists organizations_admin_write on public.organizations;
create policy organizations_admin_write on public.organizations for all to authenticated
using (public.is_admin()) with check (public.is_admin() and created_by = (select auth.uid()));

drop policy if exists offers_public_select on public.internship_offers;
create policy offers_public_select on public.internship_offers for select to anon, authenticated
using ((published and exists (select 1 from public.organizations o where o.id = organization_id and o.is_active)) or public.is_admin());
drop policy if exists offers_admin_write on public.internship_offers;
create policy offers_admin_write on public.internship_offers for all to authenticated
using (public.is_admin()) with check (public.is_admin() and created_by = (select auth.uid()));

grant select on public.organizations, public.internship_offers to anon, authenticated;
grant insert, update, delete on public.organizations, public.internship_offers to authenticated;
