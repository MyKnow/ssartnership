-- RF-02 (#535): privilege defaults, retention/purge, member anonymization
-- scope, project showcase terminal-state guards, partner metric actor filter,
-- public media bucket limits and audit-preserving foreign keys.
--
-- Self-host receivers never apply DDL. The operator applies this file
-- manually after a verified backup; every statement is forward-only and the
-- previous application image keeps working against the resulting schema.

-- Retention ------------------------------------------------------------------
-- Defaults are documented in docs/security/data-lifecycle.md and stay in effect
-- until the operator confirms or replaces them in a later migration. Holds can
-- protect every group, including the new ones.
alter table public.log_retention_holds
  drop constraint if exists log_retention_holds_group_check;
alter table public.log_retention_holds
  add constraint log_retention_holds_group_check
  check (log_group in (
    'event_logs',
    'admin_audit_logs',
    'auth_security_logs',
    'push_message_logs',
    'push_delivery_logs',
    'partner_benefit_usages',
    'rate_limit_attempts',
    'notification_deliveries',
    'image_upload_sessions',
    'platform_active_identities',
    'partner_metric_unique_visitors'
  ));

create or replace function public.log_retention_hold_active(
  p_log_group text,
  p_recorded_at timestamp with time zone
)
returns boolean
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.log_retention_holds hold
    where hold.log_group = p_log_group
      and (hold.expires_at is null or hold.expires_at > now())
      and p_recorded_at >= hold.start_at
      and p_recorded_at < hold.end_at
  );
$$;

create or replace function public.purge_expired_operational_logs(
  input_cutoff timestamp with time zone default now() - interval '1 year'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  cutoff timestamp with time zone := coalesce(input_cutoff, now() - interval '1 year');
  attempt_cutoff timestamp with time zone := now() - interval '30 days';
  delivery_cutoff timestamp with time zone := now() - interval '180 days';
  upload_session_cutoff timestamp with time zone := now() - interval '30 days';
  identifier_cutoff_date date := (now() at time zone 'Asia/Seoul')::date - 400;
  attempt_table text;
  affected integer := 0;
  event_log_count integer := 0;
  admin_audit_log_count integer := 0;
  auth_security_log_count integer := 0;
  push_message_log_count integer := 0;
  push_delivery_log_count integer := 0;
  partner_benefit_usage_count integer := 0;
  rate_limit_attempt_count integer := 0;
  notification_delivery_count integer := 0;
  admin_notification_delivery_count integer := 0;
  partner_notification_delivery_count integer := 0;
  image_upload_session_count integer := 0;
  platform_active_identity_count integer := 0;
  partner_metric_unique_visitor_count integer := 0;
begin
  -- The guard prevents an accidental caller from reducing the log policy below one year.
  if cutoff > now() - interval '1 year' then
    raise exception 'log_retention_cutoff_must_be_at_least_one_year_old';
  end if;

  -- Raw operational logs: one year.
  delete from public.event_logs
  where created_at < cutoff
    and not public.log_retention_hold_active('event_logs', event_logs.created_at);
  get diagnostics event_log_count = row_count;

  delete from public.admin_audit_logs
  where created_at < cutoff
    and not public.log_retention_hold_active('admin_audit_logs', admin_audit_logs.created_at);
  get diagnostics admin_audit_log_count = row_count;

  delete from public.auth_security_logs
  where created_at < cutoff
    and not public.log_retention_hold_active('auth_security_logs', auth_security_logs.created_at);
  get diagnostics auth_security_log_count = row_count;

  delete from public.push_delivery_logs
  where created_at < cutoff
    and not public.log_retention_hold_active('push_delivery_logs', push_delivery_logs.created_at);
  get diagnostics push_delivery_log_count = row_count;

  delete from public.push_message_logs
  where created_at < cutoff
    and not public.log_retention_hold_active('push_message_logs', push_message_logs.created_at);
  get diagnostics push_message_log_count = row_count;

  delete from public.partner_benefit_usages
  where created_at < cutoff
    and not public.log_retention_hold_active('partner_benefit_usages', partner_benefit_usages.created_at);
  get diagnostics partner_benefit_usage_count = row_count;

  -- Rate-limit attempts: 30 days after the window started, never while blocked.
  foreach attempt_table in array array[
    'admin_login_attempts',
    'member_auth_attempts',
    'mattermost_sender_test_attempts',
    'partner_auth_attempts',
    'partner_registration_attempts',
    'password_reset_attempts',
    'suggestion_attempts'
  ] loop
    if pg_catalog.to_regclass(pg_catalog.format('public.%I', attempt_table)) is not null then
      execute pg_catalog.format(
        'delete from public.%I attempt
         where attempt.first_attempt_at < $1
           and (attempt.blocked_until is null or attempt.blocked_until < pg_catalog.now())
           and not public.log_retention_hold_active(''rate_limit_attempts'', attempt.first_attempt_at)',
        attempt_table
      ) using attempt_cutoff;
      get diagnostics affected = row_count;
      rate_limit_attempt_count := rate_limit_attempt_count + affected;
    end if;
  end loop;

  -- Finalized notification deliveries: 180 days. Member inbox rows
  -- (member_notifications) and campaign headers are kept.
  if pg_catalog.to_regclass('public.notification_deliveries') is not null then
    delete from public.notification_deliveries delivery
    using public.notifications campaign
    where campaign.id = delivery.notification_id
      and delivery.status in ('sent', 'failed', 'skipped')
      and delivery.created_at < delivery_cutoff
      and coalesce(campaign.metadata ->> 'campaignStatus', '') <> 'pending'
      and not public.log_retention_hold_active('notification_deliveries', delivery.created_at);
    get diagnostics notification_delivery_count = row_count;
  end if;

  if pg_catalog.to_regclass('public.admin_notification_deliveries') is not null then
    delete from public.admin_notification_deliveries delivery
    where delivery.status in ('sent', 'failed', 'skipped')
      and delivery.created_at < delivery_cutoff
      and not public.log_retention_hold_active('notification_deliveries', delivery.created_at);
    get diagnostics admin_notification_delivery_count = row_count;
  end if;

  if pg_catalog.to_regclass('public.partner_notification_deliveries') is not null then
    delete from public.partner_notification_deliveries delivery
    where delivery.status in ('sent', 'failed', 'skipped')
      and delivery.created_at < delivery_cutoff
      and not public.log_retention_hold_active('notification_deliveries', delivery.created_at);
    get diagnostics partner_notification_delivery_count = row_count;
  end if;

  -- Expired upload sessions (objects already removed): 30 days after expiry.
  -- Attached sessions stay as the ledger of images still in use.
  if pg_catalog.to_regclass('public.image_upload_sessions') is not null then
    delete from public.image_upload_sessions upload_session
    where upload_session.status = 'expired'
      and upload_session.updated_at < upload_session_cutoff
      and not public.log_retention_hold_active('image_upload_sessions', upload_session.updated_at);
    get diagnostics image_upload_session_count = row_count;
  end if;

  -- Identifier ledgers: 400 days, longer than every admin activity window.
  if pg_catalog.to_regclass('public.platform_active_identities') is not null then
    delete from public.platform_active_identities identity_row
    where identity_row.activity_date < identifier_cutoff_date
      and not public.log_retention_hold_active(
        'platform_active_identities',
        identity_row.activity_date::timestamp at time zone 'Asia/Seoul'
      );
    get diagnostics platform_active_identity_count = row_count;
  end if;

  if pg_catalog.to_regclass('public.partner_metric_unique_visitors') is not null then
    delete from public.partner_metric_unique_visitors visitor
    where coalesce(
        visitor.bucket_local_date,
        visitor.bucket_local_start::date,
        (visitor.created_at at time zone 'Asia/Seoul')::date
      ) < identifier_cutoff_date
      and not public.log_retention_hold_active('partner_metric_unique_visitors', visitor.created_at);
    get diagnostics partner_metric_unique_visitor_count = row_count;
  end if;

  return jsonb_build_object(
    'cutoff', cutoff,
    'event_logs', event_log_count,
    'admin_audit_logs', admin_audit_log_count,
    'auth_security_logs', auth_security_log_count,
    'push_delivery_logs', push_delivery_log_count,
    'push_message_logs', push_message_log_count,
    'partner_benefit_usages', partner_benefit_usage_count,
    'rate_limit_attempts', rate_limit_attempt_count,
    'notification_deliveries', notification_delivery_count,
    'admin_notification_deliveries', admin_notification_delivery_count,
    'partner_notification_deliveries', partner_notification_delivery_count,
    'image_upload_sessions', image_upload_session_count,
    'platform_active_identities', platform_active_identity_count,
    'partner_metric_unique_visitors', partner_metric_unique_visitor_count
  );
end;
$$;

revoke all on function public.purge_expired_operational_logs(timestamp with time zone) from public;
revoke all on function public.purge_expired_operational_logs(timestamp with time zone) from anon;
revoke all on function public.purge_expired_operational_logs(timestamp with time zone) from authenticated;
grant execute on function public.purge_expired_operational_logs(timestamp with time zone) to service_role;

-- Member anonymization scope -------------------------------------------------
-- members rows are anonymized in place, so FK cascades never fire on this path.
-- Every member-linked table is either cleared here or explicitly retained
-- (tests/member-anonymization-fk-coverage.test.mts keeps that list complete).
create or replace function public.anonymize_deleted_member(p_member_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  member_row public.members%rowtype;
  mattermost_account_uuid uuid;
  verification_request_uuid uuid;
begin
  select * into member_row
  from public.members
  where id = p_member_id
    and deleted_at is not null
    and deleted_at <= now() - interval '30 days'
    and anonymized_at is null
  for update;

  if not found then
    return false;
  end if;

  if not public.purge_deleted_member_wallet_data_for_anonymization(p_member_id) then
    raise exception 'member_wallet_lifecycle_anonymization_gate_failed';
  end if;

  mattermost_account_uuid := member_row.mattermost_account_id;
  select verification_request_id into verification_request_uuid
  from public.graduate_profiles
  where member_id = p_member_id;

  delete from public.member_profile_images where member_id = p_member_id;
  delete from public.member_email_challenges where member_id = p_member_id;
  delete from public.member_email_login_transitions where member_id = p_member_id;
  delete from public.member_password_action_tokens where member_id = p_member_id;

  -- Legacy tables are cleaned only while they exist, so dropping them later
  -- does not depend on replacing this function first.
  if pg_catalog.to_regclass('public.member_ssafy_verifications') is not null then
    execute 'delete from public.member_ssafy_verifications where member_id = $1'
      using p_member_id;
  end if;
  if pg_catalog.to_regclass('public.member_auth_identities') is not null then
    execute 'delete from public.member_auth_identities where member_id = $1'
      using p_member_id;
  end if;

  delete from public.graduate_profiles where member_id = p_member_id;

  -- Settings, devices, inbox and member-only interactions.
  delete from public.push_preferences where member_id = p_member_id;
  delete from public.push_subscriptions where member_id = p_member_id;
  delete from public.member_notifications where member_id = p_member_id;
  delete from public.notification_deliveries where member_id = p_member_id;
  delete from public.partner_favorites where member_id = p_member_id;
  delete from public.partner_review_reactions where member_id = p_member_id;
  delete from public.admin_push_subscriptions where admin_id = p_member_id;
  delete from public.admin_notification_recipients where admin_id = p_member_id;
  delete from public.admin_notification_preferences where admin_id = p_member_id;
  delete from public.admin_notification_deliveries where admin_id = p_member_id;

  -- Evidence rows stay, without the network identifiers or contact snapshots.
  update public.member_policy_consents
  set ip_address = null,
      user_agent = null
  where member_id = p_member_id
    and (ip_address is not null or user_agent is not null);
  update public.graduate_verification_uploads
  set member_id = null
  where member_id = p_member_id;
  update public.push_delivery_logs
  set member_id = null
  where member_id = p_member_id;
  update public.push_message_logs
  set target_member_id = null
  where target_member_id = p_member_id;
  update public.manual_member_import_rows
  set member_id = null,
      display_name = null,
      mm_username = null,
      email = null,
      email_normalized = null
  where member_id = p_member_id;
  update public.event_reward_winners
  set display_name = '탈퇴한 회원',
      mm_username = null,
      campus = null
  where member_id = p_member_id;

  -- Project showcase: the same detachment the post-settlement purge applies.
  delete from public.showcase_project_participants participant
  using public.showcase_projects project
  where project.id = participant.project_id
    and project.owner_member_id = p_member_id
    and participant.is_owner;
  update public.showcase_registrations
  set member_id = null,
      student_number = null
  where member_id = p_member_id;
  update public.showcase_project_views set member_id = null where member_id = p_member_id;
  update public.showcase_experiences set member_id = null where member_id = p_member_id;
  update public.showcase_feedback set member_id = null where member_id = p_member_id;
  update public.showcase_interests set member_id = null where member_id = p_member_id;
  update public.showcase_candidate_exclusions set member_id = null where member_id = p_member_id;
  update public.showcase_winners set member_id = null where member_id = p_member_id;
  update public.showcase_projects set owner_member_id = null where owner_member_id = p_member_id;

  update public.graduate_verification_requests as request
  set email = concat('deleted+', request.id::text, '@deleted.invalid'),
      email_normalized = concat('deleted+', request.id::text, '@deleted.invalid'),
      legal_name = '탈퇴한 수료생',
      document_number_hmac = null,
      certificate_storage_path = null,
      certificate_sha256 = null,
      certificate_deleted_at = coalesce(request.certificate_deleted_at, now()),
      review_note = null,
      rejection_reason = null,
      status = case
        when request.request_kind = 'existing_member_recovery'
          and request.recovery_member_id = p_member_id
          and request.status = 'approved'
        then 'withdrawn'
        else request.status
      end,
      recovery_member_id = case
        when request.recovery_member_id = p_member_id then null
        else request.recovery_member_id
      end,
      updated_at = now()
  where request.id = verification_request_uuid
     or request.recovery_member_id = p_member_id;

  update public.members
  set email = null,
      email_normalized = null,
      email_verified_at = null,
      manual_login_id = null,
      password_hash = null,
      password_salt = null,
      must_change_password = false,
      display_name = '탈퇴한 회원',
      campus = null,
      staff_source_generation = null,
      mattermost_account_id = null,
      mattermost_login_disabled_at = null,
      mattermost_login_disabled_reason = null,
      auth_session_version = auth_session_version + 1,
      anonymized_at = now(),
      updated_at = now()
  where id = p_member_id;

  if mattermost_account_uuid is not null then
    delete from public.mm_user_directory directory
    where directory.id = mattermost_account_uuid
      and not exists (
        select 1
        from public.members linked_member
        where linked_member.mattermost_account_id = directory.id
      );
  end if;

  return true;
end;
$$;

revoke all on function public.anonymize_deleted_member(uuid) from public;
revoke all on function public.anonymize_deleted_member(uuid) from anon;
revoke all on function public.anonymize_deleted_member(uuid) from authenticated;
grant execute on function public.anonymize_deleted_member(uuid) to service_role;

-- Public schema privilege defaults --------------------------------------------
-- The application reaches the database only through the service role. Remove
-- every PUBLIC/anon/authenticated privilege that earlier migrations may have
-- forgotten to revoke, then change the defaults so a future migration that
-- forgets a revoke stays closed. Extension-owned routines keep their ACLs.
do $public_routine_privileges$
declare
  routine record;
begin
  for routine in
    select procedure_row.oid::regprocedure as signature
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace_row
      on namespace_row.oid = procedure_row.pronamespace
    where namespace_row.nspname = 'public'
      and not exists (
        select 1
        from pg_catalog.pg_depend dependency
        where dependency.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
          and dependency.objid = procedure_row.oid
          and dependency.deptype = 'e'
      )
    order by procedure_row.oid
  loop
    execute pg_catalog.format(
      'revoke all on routine %s from public, anon, authenticated',
      routine.signature
    );
    execute pg_catalog.format(
      'grant execute on routine %s to service_role',
      routine.signature
    );
  end loop;
end
$public_routine_privileges$;

do $public_relation_privileges$
declare
  table_record record;
  sequence_record record;
begin
  for table_record in
    select schemaname, tablename
    from pg_catalog.pg_tables
    where schemaname = 'public'
    order by tablename
  loop
    execute pg_catalog.format(
      'alter table %I.%I enable row level security',
      table_record.schemaname,
      table_record.tablename
    );
    execute pg_catalog.format(
      'revoke all on table %I.%I from public, anon, authenticated',
      table_record.schemaname,
      table_record.tablename
    );
  end loop;

  for sequence_record in
    select sequence_schema, sequence_name
    from information_schema.sequences
    where sequence_schema = 'public'
    order by sequence_name
  loop
    execute pg_catalog.format(
      'revoke all on sequence %I.%I from public, anon, authenticated',
      sequence_record.sequence_schema,
      sequence_record.sequence_name
    );
  end loop;
end
$public_relation_privileges$;

-- Supabase grants anon/authenticated on every new public object by default.
-- Per-schema revokes reverse those grants; PUBLIC EXECUTE on functions is a
-- global default, so it is revoked per creating role. Only roles the migration
-- runner may act for are changed.
do $public_default_privileges$
declare
  owner_role text;
begin
  foreach owner_role in array array['postgres', 'supabase_admin'] loop
    if exists (select 1 from pg_catalog.pg_roles where rolname = owner_role)
      and pg_catalog.pg_has_role(current_user, owner_role, 'MEMBER') then
      execute pg_catalog.format(
        'alter default privileges for role %I revoke execute on functions from public',
        owner_role
      );
      execute pg_catalog.format(
        'alter default privileges for role %I in schema public revoke all on functions from anon, authenticated',
        owner_role
      );
      execute pg_catalog.format(
        'alter default privileges for role %I in schema public revoke all on tables from anon, authenticated',
        owner_role
      );
      execute pg_catalog.format(
        'alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated',
        owner_role
      );
      execute pg_catalog.format(
        'alter default privileges for role %I in schema public grant execute on functions to service_role',
        owner_role
      );
    end if;
  end loop;
end
$public_default_privileges$;

-- Fail the migration instead of leaving a browser-reachable object behind.
do $verify_public_exposure$
declare
  exposed text;
begin
  select pg_catalog.string_agg(procedure_row.oid::regprocedure::text, ', ')
  into exposed
  from pg_catalog.pg_proc procedure_row
  join pg_catalog.pg_namespace namespace_row
    on namespace_row.oid = procedure_row.pronamespace
  where namespace_row.nspname = 'public'
    and not exists (
      select 1
      from pg_catalog.pg_depend dependency
      where dependency.classid = 'pg_catalog.pg_proc'::pg_catalog.regclass
        and dependency.objid = procedure_row.oid
        and dependency.deptype = 'e'
    )
    and (
      pg_catalog.has_function_privilege('anon', procedure_row.oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated', procedure_row.oid, 'EXECUTE')
    );
  if exposed is not null then
    raise exception 'public_routine_exposed:%', exposed;
  end if;

  select pg_catalog.string_agg(pg_catalog.format('%I.%I', schemaname, tablename), ', ')
  into exposed
  from pg_catalog.pg_tables
  where schemaname = 'public'
    and (
      not rowsecurity
      or pg_catalog.has_table_privilege(
        'anon',
        pg_catalog.format('%I.%I', schemaname, tablename),
        'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
      )
      or pg_catalog.has_table_privilege(
        'authenticated',
        pg_catalog.format('%I.%I', schemaname, tablename),
        'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'
      )
    );
  if exposed is not null then
    raise exception 'public_table_exposed:%', exposed;
  end if;
end
$verify_public_exposure$;
