-- =============================================================================
-- StageFlow — 9999 : DEV/TEST seed
-- =============================================================================
-- ⚠️  NEVER RUN THIS AGAINST PRODUCTION.
--
-- This migration only seeds data when the database is a local development
-- instance. It inserts deterministic demo applications directly, bypassing the
-- RPCs on purpose so fixtures are reproducible, and it does NOT create any
-- administrator account: admins are always created by the audited operator
-- bootstrap in 0005.
--
-- Guard: the whole file is a no-op unless the `stageflow.seed_demo` setting is
-- explicitly enabled for the database. The setting name MUST contain a dot;
-- an unqualified name is rejected by PostgreSQL.
--
--   alter database postgres set "stageflow.seed_demo" = 'on';
--   -- then re-run this file
--
-- Disable again with:
--
--   alter database postgres reset "stageflow.seed_demo";
--
-- Document uploads are not seeded because the bytes live in Storage; the seed
-- therefore uses applications that are SUBMITTED/UNDER_REVIEW/decided but whose
-- document list is populated by the operator via the UI when needed.
-- =============================================================================

do $$
declare
  v_seed text := current_setting('stageflow.seed_demo', true);
  v_uid  uuid;
  v_app  uuid;
  v_names text[][] := array[
    ['Sara','Ahmed','Génie informatique','ENSET Rabat','Développement Web'],
    ['Yassine','El Amrani','Design graphique','ESAV Marrakech','Design graphique'],
    ['Ahmed','Benali','Développement Web','FS Rabat','Développement informatique'],
    ['Imane','Ketani','Marketing digital','ENCG Casablanca','Marketing digital'],
    ['Omar','Fassi','Cybersécurité','ENSIAS Rabat','Cybersécurité'],
    ['Hind','Mansouri','Réseaux & télécom','INPT Rabat','Réseaux & télécom'],
    ['Lina','Berrada','Gestion & finance','ENCG Rabat','Gestion & finance']
  ];
  v_statuses public.application_status[] := array['SUBMITTED','SUBMITTED','ACCEPTED','REJECTED','SUBMITTED','UNDER_REVIEW','ACCEPTED']::public.application_status[];
  i integer;
begin
  if coalesce(v_seed, 'off') <> 'on' then
    raise notice 'StageFlow seed skipped: set stageflow.seed_demo = ''on'' to enable demo fixtures.';
    return;
  end if;

  raise notice 'StageFlow demo seed is ON — inserting fixtures. NEVER use this in production.';

  for i in 1 .. array_length(v_names, 1) loop
    v_uid := gen_random_uuid();

    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      v_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      lower(v_names[i][1] || '.' || v_names[i][2]) || '@demo.stageflow.local',
      crypt('DemoStageFlow' || i::text || '!', gen_salt('bf')),
      timezone('utc', now()),
      jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
      jsonb_build_object('first_name', v_names[i][1], 'last_name', v_names[i][2], 'seed', true),
      timezone('utc', now()) - (30 - i) * interval '1 day',
      timezone('utc', now()) - (30 - i) * interval '1 day',
      '', '', '', ''
    )
    on conflict (id) do nothing;

    -- The auth trigger already created profile + role; enrich the profile with
    -- the academic snapshot used by the mockup fixtures.
    update public.profiles
    set school      = v_names[i][4],
        program     = v_names[i][3],
        study_level = '3ème année',
        specialty   = v_names[i][5],
        phone       = '+212 6 12 34 56 78',
        city        = 'Rabat'
    where id = v_uid;

    insert into public.internship_applications (
      applicant_id, stage_type, domain, start_date, end_date, mode, motivation,
      school, program, study_level, specialty, status,
      submitted_at, reviewed_at, decided_at, public_rejection_reason
    ) values (
      v_uid,
      'Stage de fin d’études',
      v_names[i][5],
      date '2027-03-01',
      date '2027-05-31',
      'Présentiel',
      'Je souhaite approfondir mes compétences en ' || v_names[i][5] ||
        ' et contribuer à des projets concrets au sein de votre équipe.',
      v_names[i][4],
      v_names[i][3],
      '3ème année',
      v_names[i][5],
      v_statuses[i],
      timezone('utc', now()) - (20 - i) * interval '1 day',
      case when v_statuses[i] in ('UNDER_REVIEW','ACCEPTED','REJECTED')
           then timezone('utc', now()) - (15 - i) * interval '1 day' end,
      case when v_statuses[i] in ('ACCEPTED','REJECTED')
           then timezone('utc', now()) - (5 - i) * interval '1 day' end,
      case when v_statuses[i] = 'REJECTED'
           then 'Le profil ne correspond pas aux besoins du poste pour la période demandée.' end
    )
    returning id into v_app;

    insert into public.application_status_history (application_id, from_status, to_status, actor_id, actor_role, public_note, created_at)
    values
      (v_app, null, 'DRAFT', v_uid, 'stagiaire', 'Brouillon créé', timezone('utc', now()) - (25 - i) * interval '1 day'),
      (v_app, 'DRAFT', 'SUBMITTED', v_uid, 'stagiaire', 'Votre demande a été envoyée à l’administration.', timezone('utc', now()) - (20 - i) * interval '1 day');

    if v_statuses[i] in ('UNDER_REVIEW','ACCEPTED','REJECTED') then
      insert into public.application_status_history (application_id, from_status, to_status, actor_id, actor_role, public_note, created_at)
      values (v_app, 'SUBMITTED', 'UNDER_REVIEW', null, 'admin', 'Votre dossier est en cours d’examen par l’administration.', timezone('utc', now()) - (15 - i) * interval '1 day');
    end if;

    if v_statuses[i] = 'ACCEPTED' then
      insert into public.application_status_history (application_id, from_status, to_status, actor_id, actor_role, public_note, created_at)
      values (v_app, 'UNDER_REVIEW', 'ACCEPTED', null, 'admin', 'Dossier conforme aux besoins du service. Bienvenue !', timezone('utc', now()) - (5 - i) * interval '1 day');
    elsif v_statuses[i] = 'REJECTED' then
      insert into public.application_status_history (application_id, from_status, to_status, actor_id, actor_role, public_note, created_at)
      values (v_app, 'UNDER_REVIEW', 'REJECTED', null, 'admin', 'Le profil ne correspond pas aux besoins du poste pour la période demandée.', timezone('utc', now()) - (5 - i) * interval '1 day');
    end if;
  end loop;

  raise notice 'StageFlow demo seed complete: % fixtures.', array_length(v_names, 1);
end
$$;
