-- =============================================================================
-- StageFlow — 0002 : indexes, statistics view and query helpers
-- =============================================================================
-- Kept separate from 0001 so the schema definition stays readable.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Trigram indexes for tolerant name/email/formation search on the admin list.
-- ---------------------------------------------------------------------------
create extension if not exists "pg_trgm";

create index if not exists profiles_name_trgm_idx
  on public.profiles using gin ((first_name || ' ' || last_name) gin_trgm_ops);
create index if not exists profiles_school_trgm_idx
  on public.profiles using gin (coalesce(school, '') gin_trgm_ops);
create index if not exists applications_domain_trgm_idx
  on public.internship_applications using gin (domain gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Admin listing view
-- ---------------------------------------------------------------------------
-- Pre-joins the applicant identity so the list endpoint issues one query rather
-- than N+1 round trips. security_invoker = true means the VIEW runs with the
-- caller's permissions and therefore inherits the RLS policies of the
-- underlying tables — it is not a privilege escalation path.
create or replace view public.admin_application_list
with (security_invoker = true)
as
select
  a.id,
  a.applicant_id,
  a.stage_type,
  a.domain,
  a.start_date,
  a.end_date,
  a.status,
  a.submitted_at,
  a.reviewed_at,
  a.decided_at,
  a.created_at,
  a.version,
  a.program,
  p.first_name,
  p.last_name,
  p.school,
  p.study_level,
  coalesce(p.program, a.program) as display_program,
  (select count(*) from public.application_documents d where d.application_id = a.id) as document_count
from public.internship_applications a
left join public.profiles p on p.id = a.applicant_id
where a.status <> 'DRAFT';

comment on view public.admin_application_list is
  'Admin-facing projection of submitted applications. Inherits RLS from the base tables (security_invoker).';

grant select on public.admin_application_list to authenticated;

-- ---------------------------------------------------------------------------
-- search_admin_applications — parameterised, server-side search/filter/sort/page
-- ---------------------------------------------------------------------------
-- Doing this in the database gives us stable pagination and bounded result sets
-- without ever pulling every applicant into the browser.
create or replace function public.search_admin_applications(
  p_query       text default '',
  p_status      public.application_status default null,
  p_formation   text default '',
  p_stage_type  text default '',
  p_date_from   date default null,
  p_date_to     date default null,
  p_sort        text default 'created_at',
  p_direction   text default 'desc',
  p_limit       integer default 10,
  p_offset      integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q       text := lower(trim(coalesce(p_query, '')));
  v_limit   integer := least(greatest(coalesce(p_limit, 10), 1), 25);
  v_offset  integer := greatest(coalesce(p_offset, 0), 0);
  v_sort    text := case
                       when p_sort in ('submitted_at','created_at','start_date','last_name') then p_sort
                       else 'created_at'
                     end;
  v_dir     text := case when lower(coalesce(p_direction,'desc')) = 'asc' then 'asc' else 'desc' end;
  v_total   integer;
  v_rows    jsonb;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with filtered as (
    select l.*
    from public.admin_application_list l
    where (p_status is null or l.status = p_status)
      and (v_q = '' or
           lower(coalesce(l.first_name,'') || ' ' || coalesce(l.last_name,'')) like '%' || v_q || '%'
           or lower(coalesce(l.display_program,'')) like '%' || v_q || '%'
           or lower(coalesce(l.school,'')) like '%' || v_q || '%'
           or lower(coalesce(l.domain,'')) like '%' || v_q || '%'
           or lower(coalesce(l.stage_type,'')) like '%' || v_q || '%')
      and (coalesce(p_formation,'') = '' or lower(coalesce(l.display_program,'')) = lower(p_formation))
      and (coalesce(p_stage_type,'') = '' or l.stage_type = p_stage_type)
      and (p_date_from is null or coalesce(l.start_date, l.created_at::date) >= p_date_from)
      and (p_date_to   is null or coalesce(l.start_date, l.created_at::date) <= p_date_to)
  )
  select count(*) into v_total from filtered;

  with filtered as (
    select l.*
    from public.admin_application_list l
    where (p_status is null or l.status = p_status)
      and (v_q = '' or
           lower(coalesce(l.first_name,'') || ' ' || coalesce(l.last_name,'')) like '%' || v_q || '%'
           or lower(coalesce(l.display_program,'')) like '%' || v_q || '%'
           or lower(coalesce(l.school,'')) like '%' || v_q || '%'
           or lower(coalesce(l.domain,'')) like '%' || v_q || '%'
           or lower(coalesce(l.stage_type,'')) like '%' || v_q || '%')
      and (coalesce(p_formation,'') = '' or lower(coalesce(l.display_program,'')) = lower(p_formation))
      and (coalesce(p_stage_type,'') = '' or l.stage_type = p_stage_type)
      and (p_date_from is null or coalesce(l.start_date, l.created_at::date) >= p_date_from)
      and (p_date_to   is null or coalesce(l.start_date, l.created_at::date) <= p_date_to)
    order by
      case when v_sort = 'created_at'   and v_dir = 'desc' then l.created_at   end desc nulls last,
      case when v_sort = 'created_at'   and v_dir = 'asc'  then l.created_at   end asc  nulls last,
      case when v_sort = 'submitted_at' and v_dir = 'desc' then l.submitted_at end desc nulls last,
      case when v_sort = 'submitted_at' and v_dir = 'asc'  then l.submitted_at end asc  nulls last,
      case when v_sort = 'start_date'   and v_dir = 'desc' then l.start_date   end desc nulls last,
      case when v_sort = 'start_date'   and v_dir = 'asc'  then l.start_date   end asc  nulls last,
      case when v_sort = 'last_name'    and v_dir = 'desc' then lower(coalesce(l.last_name,'')) end desc nulls last,
      case when v_sort = 'last_name'    and v_dir = 'asc'  then lower(coalesce(l.last_name,'')) end asc  nulls last,
      l.id
    limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',              f.id,
    'firstName',       f.first_name,
    'lastName',        f.last_name,
    'program',         f.display_program,
    'school',          f.school,
    'studyLevel',      f.study_level,
    'stageType',       f.stage_type,
    'domain',          f.domain,
    'startDate',       f.start_date,
    'endDate',         f.end_date,
    'submittedAt',     f.submitted_at,
    'createdAt',       f.created_at,
    'status',          f.status,
    'documentCount',   f.document_count
  )), '[]'::jsonb)
  into v_rows
  from filtered f;

  return jsonb_build_object(
    'rows',  v_rows,
    'total', coalesce(v_total, 0),
    'page',  (v_offset / v_limit) + 1,
    'pageSize', v_limit
  );
end;
$$;

revoke all on function public.search_admin_applications(text, public.application_status, text, text, date, date, text, text, integer, integer) from public;
grant execute on function public.search_admin_applications(text, public.application_status, text, text, date, date, text, text, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- get_application_history — safe timeline for the owner or an admin
-- ---------------------------------------------------------------------------
create or replace function public.get_application_history(p_application_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_is_admin boolean := public.is_admin();
  v_owner    uuid;
  v_rows     jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  select applicant_id into v_owner
  from public.internship_applications
  where id = p_application_id;

  if v_owner is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_owner <> v_uid and not v_is_admin then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',        h.id,
    'fromStatus',h.from_status,
    'toStatus',  h.to_status,
    'actorRole', h.actor_role,
    'note',      h.public_note,
    'createdAt', h.created_at
  ) order by h.created_at), '[]'::jsonb)
  into v_rows
  from public.application_status_history h
  where h.application_id = p_application_id;

  return v_rows;
end;
$$;

revoke all on function public.get_application_history(uuid) from public;
grant execute on function public.get_application_history(uuid) to authenticated;
