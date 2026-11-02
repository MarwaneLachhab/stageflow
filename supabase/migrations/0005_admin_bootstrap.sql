-- =============================================================================
-- StageFlow — 0005 : audited admin bootstrap
-- =============================================================================
-- THERE IS NO PUBLIC ADMIN SIGNUP. Elevating an account is a deliberate,
-- operator-only, auditable action performed against the database, never through
-- an HTTP endpoint a client could reach.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- HOW TO CREATE THE FIRST ADMINISTRATOR
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The future administrator registers normally through /inscription. Public
--    signup can only ever produce a `stagiaire`.
--
-- 2. An operator with database access promotes the account. Replace the e-mail:
--
--      select public.promote_to_admin('admin@votre-entreprise.ma');
--
--    The function refuses to run if the address is unknown, and it records the
--    promotion in audit_events so the change is attributable.
--
-- 3. Demote with:
--
--      select public.demote_admin('admin@votre-entreprise.ma');
--
-- Never run these against production from an application request. Restrict DB
-- access with platform roles and keep an operator log.
-- =============================================================================

create or replace function public.promote_to_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    -- is_admin() is false for the bootstrap itself, so operators connecting with
    -- an elevated database role are allowed through the second clause.
    raise exception 'FORBIDDEN: promote_to_admin requires operator database access' using errcode = '42501';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'NOT_FOUND: no user with e-mail %', p_email using errcode = 'P0002';
  end if;

  insert into public.user_roles (user_id, role, granted_by, granted_at)
  values (v_user_id, 'admin', (select auth.uid()), timezone('utc', now()))
  on conflict (user_id) do update
    set role = 'admin',
        granted_by = excluded.granted_by,
        granted_at = timezone('utc', now());

  insert into public.audit_events (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    (select role from public.user_roles where user_id = (select auth.uid())),
    'admin.promoted',
    'user_role',
    v_user_id,
    jsonb_build_object('email', lower(trim(p_email)))
  );

  return v_user_id;
end;
$$;

create or replace function public.demote_admin(p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'FORBIDDEN: demote_admin requires operator database access' using errcode = '42501';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'NOT_FOUND: no user with e-mail %', p_email using errcode = 'P0002';
  end if;

  update public.user_roles
  set role = 'stagiaire', granted_by = (select auth.uid()), granted_at = timezone('utc', now())
  where user_id = v_user_id;

  insert into public.audit_events (actor_id, actor_role, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    (select role from public.user_roles where user_id = (select auth.uid())),
    'admin.demoted',
    'user_role',
    v_user_id,
    jsonb_build_object('email', lower(trim(p_email)))
  );

  return v_user_id;
end;
$$;

-- Only elevated database roles may execute the bootstrap helpers.
revoke all on function public.promote_to_admin(text) from public, anon, authenticated;
revoke all on function public.demote_admin(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Guard: the app_role column may never be set by a client session.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_self_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    raise exception 'FORBIDDEN: user_roles is not writable from a client session' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists user_roles_guard on public.user_roles;
create trigger user_roles_guard
  before insert or update or delete on public.user_roles
  for each row execute function public.prevent_role_self_assignment();
