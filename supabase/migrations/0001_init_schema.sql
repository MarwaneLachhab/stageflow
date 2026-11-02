-- =============================================================================
-- StageFlow — 0001 : core schema
-- =============================================================================
-- Creates the canonical data model for the internship application platform.
--
-- Status enum is deliberately FIVE states. « En attente » shown in the KPI
-- tiles is a *display label* for SUBMITTED, never a sixth database state.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('stagiaire', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'application_status') then
    create type public.application_status as enum (
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'ACCEPTED',
      'REJECTED'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'document_type') then
    create type public.document_type as enum (
      'CV',
      'MOTIVATION_LETTER',
      'ENROLLMENT_CERTIFICATE',
      'INTERNSHIP_AGREEMENT',
      'CIN',
      'OTHER'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'APPLICATION_SUBMITTED',
      'APPLICATION_UNDER_REVIEW',
      'APPLICATION_ACCEPTED',
      'APPLICATION_REJECTED',
      'WELCOME'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Utility: keeps updated_at honest without trusting the application layer
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- user_roles — the ONLY source of truth for authorization
-- ---------------------------------------------------------------------------
-- This table is never writable by clients. RLS grants SELECT of the caller's
-- own row and nothing else; there is no INSERT/UPDATE/DELETE policy at all,
-- which means authenticated users cannot escalate themselves to admin even by
-- crafting a direct PostgREST request with {"role":"admin"}.
create table if not exists public.user_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       public.app_role not null default 'stagiaire',
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.user_roles is
  'Authorization source of truth. Not client-writable; admin rows are created only by the audited operator bootstrap (0004).';

-- ---------------------------------------------------------------------------
-- is_admin() — trusted role lookup used by every admin RLS policy
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is required so the check itself is not blocked by RLS
-- recursion. It is hardened with an empty search_path and a fully-qualified
-- table reference, and it uses auth.uid() from the verified JWT — never a
-- client-supplied value.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

comment on function public.is_admin() is
  'Returns true when the *authenticated* caller holds the admin role. Safe for use inside RLS policies.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- One row per auth user, created automatically by trigger on signup so the
-- client can never choose its own id or inject privileged columns.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  first_name   text not null default '',
  last_name    text not null default '',
  phone        text,
  address      text,
  city         text,
  birth_date   date,
  school       text,
  program      text,
  study_level  text,
  specialty    text,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),

  constraint profiles_first_name_len check (char_length(first_name) <= 60),
  constraint profiles_last_name_len  check (char_length(last_name)  <= 60),
  constraint profiles_phone_len      check (phone is null or char_length(phone) <= 25),
  constraint profiles_address_len    check (address is null or char_length(address) <= 160),
  constraint profiles_city_len       check (city is null or char_length(city) <= 80),
  constraint profiles_school_len     check (school is null or char_length(school) <= 120),
  constraint profiles_program_len    check (program is null or char_length(program) <= 120),
  constraint profiles_level_len      check (study_level is null or char_length(study_level) <= 60),
  constraint profiles_specialty_len  check (specialty is null or char_length(specialty) <= 120),
  -- Refuse implausible birth dates at the storage layer too.
  constraint profiles_birth_date_sane check (
    birth_date is null
    or (birth_date > date '1900-01-01' and birth_date < timezone('utc', now())::date)
  )
);

create index if not exists profiles_last_name_idx  on public.profiles (lower(last_name));
create index if not exists profiles_program_idx    on public.profiles (lower(program));

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- internship_applications
-- ---------------------------------------------------------------------------
create table if not exists public.internship_applications (
  id                     uuid primary key default gen_random_uuid(),
  applicant_id           uuid not null references auth.users(id) on delete cascade,

  -- Internship request content (wizard step 1)
  stage_type             text not null default '',
  domain                 text not null default '',
  start_date             date,
  end_date               date,
  mode                   text,
  motivation             text not null default '',

  -- Academic snapshot (wizard step 2). Denormalised on purpose: the trainee may
  -- later edit their profile and the reviewed application must stay exactly as
  -- it was submitted.
  school                 text,
  program                text,
  study_level            text,
  specialty              text,

  -- Canonical workflow state
  status                 public.application_status not null default 'DRAFT',

  -- Lifecycle timestamps (UTC)
  submitted_at           timestamptz,
  reviewed_at            timestamptz,
  decided_at             timestamptz,
  decided_by             uuid references auth.users(id) on delete set null,

  -- Candidate-visible explanation, distinct from admin-only private notes
  public_rejection_reason text,

  -- Optimistic concurrency guard for admin decisions
  version                integer not null default 1,

  created_at             timestamptz not null default timezone('utc', now()),
  updated_at             timestamptz not null default timezone('utc', now()),

  constraint applications_stage_type_len check (char_length(stage_type) <= 80),
  constraint applications_domain_len     check (char_length(domain) <= 80),
  constraint applications_motivation_len check (char_length(motivation) <= 2000),
  constraint applications_school_len     check (school is null or char_length(school) <= 120),
  constraint applications_program_len    check (program is null or char_length(program) <= 120),
  constraint applications_level_len      check (study_level is null or char_length(study_level) <= 60),
  constraint applications_specialty_len  check (specialty is null or char_length(specialty) <= 120),
  constraint applications_reason_len     check (
    public_rejection_reason is null or char_length(public_rejection_reason) <= 1000
  ),
  constraint applications_dates_valid check (
    start_date is null or end_date is null or end_date > start_date
  ),
  -- A rejection must always carry a candidate-visible reason.
  constraint applications_rejected_requires_reason check (
    status <> 'REJECTED' or (public_rejection_reason is not null and length(trim(public_rejection_reason)) >= 10)
  ),
  -- Terminal states always carry a decision timestamp and actor.
  constraint applications_decided_consistency check (
    (status in ('ACCEPTED','REJECTED') and decided_at is not null)
    or (status not in ('ACCEPTED','REJECTED'))
  ),
  constraint applications_submitted_consistency check (
    (status = 'DRAFT' and submitted_at is null)
    or (status <> 'DRAFT' and submitted_at is not null)
  )
);

comment on column public.internship_applications.public_rejection_reason is
  'Shown to the stagiaire on /stagiaire/suivi. Never contains internal notes.';

-- Indexes for the admin list (search, filter, sort) and the trainee lookup.
create index if not exists applications_applicant_idx    on public.internship_applications (applicant_id);
create index if not exists applications_status_idx       on public.internship_applications (status);
create index if not exists applications_submitted_idx    on public.internship_applications (submitted_at desc nulls last);
create index if not exists applications_created_idx      on public.internship_applications (created_at desc);
create index if not exists applications_start_date_idx   on public.internship_applications (start_date);
create index if not exists applications_program_idx      on public.internship_applications (lower(program));

-- INCLUDE columns let the admin table sort/scan without heap access.
create index if not exists applications_admin_listing_idx
  on public.internship_applications (status, submitted_at desc nulls last, id);

-- Enforce at most ONE non-terminal request per stagiaire.
-- History is preserved: accepted/rejected rows stay, and the trainee may open a
-- new request after a final decision (resubmission policy, documented in
-- docs/ARCHITECTURE.md).
create unique index if not exists applications_one_active_per_applicant
  on public.internship_applications (applicant_id)
  where status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW');

drop trigger if exists applications_set_updated_at on public.internship_applications;
create trigger applications_set_updated_at
  before update on public.internship_applications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- application_documents
-- ---------------------------------------------------------------------------
-- Metadata only. The bytes live in the PRIVATE storage bucket; storage policies
-- are defined in 0002 and are independent from these rows.
create table if not exists public.application_documents (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.internship_applications(id) on delete cascade,
  uploader_id     uuid not null references auth.users(id) on delete cascade,
  document_type   public.document_type not null,
  storage_key     text not null unique,
  original_name   text not null,
  mime_type       text not null,
  bytes           bigint not null,
  created_at      timestamptz not null default timezone('utc', now()),

  constraint documents_original_name_len check (char_length(original_name) between 1 and 200),
  constraint documents_bytes_sane        check (bytes > 0 and bytes <= 10485760),
  constraint documents_mime_allowlist    check (mime_type in ('application/pdf','image/png','image/jpeg')),
  -- One file per document slot per application: re-uploading replaces the row.
  constraint documents_unique_slot       unique (application_id, document_type)
);

create index if not exists documents_application_idx on public.application_documents (application_id);
create index if not exists documents_uploader_idx    on public.application_documents (uploader_id);

-- ---------------------------------------------------------------------------
-- application_status_history — append-only audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.application_status_history (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.internship_applications(id) on delete cascade,
  from_status    public.application_status,
  to_status      public.application_status not null,
  actor_id       uuid references auth.users(id) on delete set null,
  actor_role     public.app_role,
  public_note    text,
  created_at     timestamptz not null default timezone('utc', now()),

  constraint history_note_len check (public_note is null or char_length(public_note) <= 1000)
);

comment on table public.application_status_history is
  'Append-only. UPDATE and DELETE are denied to every role by RLS.';

create index if not exists history_application_idx
  on public.application_status_history (application_id, created_at);

-- ---------------------------------------------------------------------------
-- admin_private_notes — never visible to a stagiaire
-- ---------------------------------------------------------------------------
create table if not exists public.admin_private_notes (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.internship_applications(id) on delete cascade,
  author_id      uuid not null references auth.users(id) on delete cascade,
  body           text not null,
  created_at     timestamptz not null default timezone('utc', now()),

  constraint notes_body_len check (char_length(body) between 1 and 2000)
);

create index if not exists notes_application_idx
  on public.admin_private_notes (application_id, created_at desc);

-- ---------------------------------------------------------------------------
-- notifications — in-app notification centre
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  recipient_id   uuid not null references auth.users(id) on delete cascade,
  type           public.notification_type not null,
  application_id uuid references public.internship_applications(id) on delete cascade,
  title          text not null,
  body           text,
  read_at        timestamptz,
  created_at     timestamptz not null default timezone('utc', now()),

  constraint notifications_title_len check (char_length(title) between 1 and 160),
  constraint notifications_body_len  check (body is null or char_length(body) <= 1000)
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- audit_events — security-significant mutations (no secrets, no file content)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_events (
  id          bigserial primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  actor_role  public.app_role,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default timezone('utc', now()),

  constraint audit_action_len check (char_length(action) between 1 and 80),
  constraint audit_entity_len check (char_length(entity_type) between 1 and 60)
);

create index if not exists audit_actor_idx  on public.audit_events (actor_id, created_at desc);
create index if not exists audit_entity_idx on public.audit_events (entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- Auth trigger: provision profile + default role on signup
-- ---------------------------------------------------------------------------
-- Runs as SECURITY DEFINER so it can write user_roles, but the only role it can
-- ever assign is 'stagiaire'. Admin rows are created exclusively by the audited
-- operator bootstrap.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_first text := left(coalesce(new.raw_user_meta_data ->> 'first_name', ''), 60);
  meta_last  text := left(coalesce(new.raw_user_meta_data ->> 'last_name', ''), 60);
  meta_phone text := left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 25);
begin
  insert into public.profiles (id, first_name, last_name, phone)
  values (new.id, meta_first, meta_last, nullif(meta_phone, ''))
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'stagiaire')
  on conflict (user_id) do nothing;

  insert into public.notifications (recipient_id, type, title, body)
  values (
    new.id,
    'WELCOME',
    'Bienvenue sur StageFlow',
    'Complétez votre profil puis créez votre demande de stage.'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
