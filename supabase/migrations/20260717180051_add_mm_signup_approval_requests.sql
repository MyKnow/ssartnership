-- Mattermost 프로필 파싱에 실패한 가입자는 정회원 행을 만들지 않고
-- 운영자 승인 요청으로 보관한다. 요청 테이블은 service_role만 접근할 수
-- 있으며, 승인·반려가 끝나면 비밀번호 material을 즉시 삭제한다.
create table if not exists public.member_signup_approval_requests (
  id uuid primary key default uuid_generate_v4(),
  mm_user_id text not null,
  mattermost_account_id uuid not null references public.mm_user_directory(id) on delete restrict,
  mm_username text not null,
  mattermost_display_name text not null,
  sender_generation integer not null,
  requested_generation integer not null,
  parse_exclusion_reason text,
  password_hash text,
  password_salt text,
  service_policy_document_id uuid not null references public.policy_documents(id) on delete restrict,
  service_policy_version integer not null,
  privacy_policy_document_id uuid not null references public.policy_documents(id) on delete restrict,
  privacy_policy_version integer not null,
  marketing_policy_document_id uuid references public.policy_documents(id) on delete restrict,
  marketing_policy_version integer,
  marketing_policy_checked boolean not null default false,
  consent_agreed_at timestamp with time zone not null default now(),
  consent_ip_address text,
  consent_user_agent text,
  status text not null default 'pending',
  reviewed_by_admin_id uuid references public.members(id) on delete set null,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint member_signup_approval_requests_mm_user_id_check
    check (char_length(btrim(mm_user_id)) between 1 and 128),
  constraint member_signup_approval_requests_mm_username_check
    check (char_length(btrim(mm_username)) between 1 and 128),
  constraint member_signup_approval_requests_display_name_check
    check (char_length(btrim(mattermost_display_name)) between 1 and 128),
  constraint member_signup_approval_requests_sender_generation_check
    check (sender_generation between 1 and 99),
  constraint member_signup_approval_requests_requested_generation_check
    check (requested_generation between 0 and 99),
  constraint member_signup_approval_requests_parse_reason_check
    check (
      parse_exclusion_reason is null
      or parse_exclusion_reason in (
        'campus_ambiguous',
        'student_signal_without_affiliation',
        'display_only',
        'display_name_not_person_like',
        'profile_unavailable'
      )
    ),
  constraint member_signup_approval_requests_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint member_signup_approval_requests_password_material_check
    check (
      (status = 'pending' and password_hash is not null and password_salt is not null)
      or (status in ('approved', 'rejected') and password_hash is null and password_salt is null)
    ),
  constraint member_signup_approval_requests_marketing_policy_check
    check (
      (
        marketing_policy_checked = false
        and marketing_policy_document_id is null
        and marketing_policy_version is null
      )
      or (
        marketing_policy_checked = true
        and marketing_policy_document_id is not null
        and marketing_policy_version is not null
      )
    ),
  constraint member_signup_approval_requests_review_check
    check (
      (status = 'pending' and reviewed_by_admin_id is null and reviewed_at is null and rejection_reason is null)
      or (
        status = 'approved'
        and reviewed_by_admin_id is not null
        and reviewed_at is not null
        and rejection_reason is null
      )
      or (
        status = 'rejected'
        and reviewed_by_admin_id is not null
        and reviewed_at is not null
        and char_length(btrim(coalesce(rejection_reason, ''))) between 1 and 500
      )
    )
);

create unique index if not exists member_signup_approval_requests_pending_mm_user_idx
  on public.member_signup_approval_requests(mm_user_id)
  where status = 'pending';
create index if not exists member_signup_approval_requests_status_created_at_idx
  on public.member_signup_approval_requests(status, created_at desc);
create index if not exists member_signup_approval_requests_mm_account_status_idx
  on public.member_signup_approval_requests(mattermost_account_id, status);

drop trigger if exists member_signup_approval_requests_set_updated_at
  on public.member_signup_approval_requests;
create trigger member_signup_approval_requests_set_updated_at
  before update on public.member_signup_approval_requests
  for each row
  execute function public.set_partnership_updated_at();

create or replace function public.enforce_member_signup_approval_request_status_transition()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('approved', 'rejected') then
    return new;
  end if;

  raise exception 'invalid_member_signup_approval_request_status_transition';
end;
$$;

drop trigger if exists member_signup_approval_requests_status_transition
  on public.member_signup_approval_requests;
create trigger member_signup_approval_requests_status_transition
  before update of status on public.member_signup_approval_requests
  for each row
  execute function public.enforce_member_signup_approval_request_status_transition();

alter table public.member_signup_approval_requests enable row level security;
revoke all on table public.member_signup_approval_requests from public;
revoke all on table public.member_signup_approval_requests from anon;
revoke all on table public.member_signup_approval_requests from authenticated;
grant select, insert, update, delete on table public.member_signup_approval_requests to service_role;

alter table public.admin_permissions
  drop constraint if exists admin_permissions_resource_check;
alter table public.admin_permissions
  add constraint admin_permissions_resource_check
  check (resource in (
    'members', 'reviews', 'logs', 'brands', 'companies', 'notifications',
    'home_ads', 'events', 'cycles', 'admin_management', 'graduate_verifications',
    'profile_images', 'mattermost_senders', 'member_signup_requests'
  ));

-- 승인 요청에는 비밀번호 hash가 포함되므로 Super Admin 템플릿만 접근한다.
update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{member_signup_requests}',
  '{"create":true,"read":true,"update":true,"delete":true}'::jsonb,
  true
), updated_at = now()
where key = 'super_admin';

update public.admin_permission_templates
set permissions = jsonb_set(
  permissions,
  '{member_signup_requests}',
  '{"create":false,"read":false,"update":false,"delete":false}'::jsonb,
  true
), updated_at = now()
where key <> 'super_admin';

create or replace function public.approve_member_signup_approval_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_display_name text,
  p_generation integer,
  p_campus text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  request_row public.member_signup_approval_requests%rowtype;
  service_policy public.policy_documents%rowtype;
  privacy_policy public.policy_documents%rowtype;
  marketing_policy public.policy_documents%rowtype;
  new_member_id uuid;
  resolved_campus text;
  agreed_at timestamp with time zone;
begin
  if not exists (
    select 1
    from public.admin_profiles profile
    join public.members admin_member on admin_member.id = profile.member_id
    where profile.member_id = p_admin_id
      and profile.permission_template_key = 'super_admin'
      and profile.is_active = true
      and admin_member.deleted_at is null
  ) then
    raise exception 'member_signup_approval_super_admin_required';
  end if;

  if p_display_name is null or char_length(btrim(p_display_name)) not between 1 and 128 then
    raise exception 'member_signup_approval_display_name_invalid';
  end if;
  if p_generation is null or p_generation not between 0 and 99 then
    raise exception 'member_signup_approval_generation_invalid';
  end if;

  resolved_campus := nullif(btrim(coalesce(p_campus, '')), '');
  if p_generation = 0 then
    resolved_campus := null;
  elsif resolved_campus is null or resolved_campus not in ('서울', '구미', '대전', '부울경', '광주') then
    raise exception 'member_signup_approval_campus_invalid';
  end if;

  select * into request_row
  from public.member_signup_approval_requests
  where id = p_request_id
  for update;

  if not found or request_row.status <> 'pending' then
    raise exception 'member_signup_approval_request_not_pending';
  end if;
  if request_row.password_hash is null or request_row.password_salt is null then
    raise exception 'member_signup_approval_password_material_missing';
  end if;

  if exists (
    select 1
    from public.members member
    where member.mattermost_account_id = request_row.mattermost_account_id
      and member.deleted_at is null
  ) then
    raise exception 'member_signup_approval_member_already_exists';
  end if;

  select * into service_policy
  from public.policy_documents
  where id = request_row.service_policy_document_id
    and kind = 'service'
    and version = request_row.service_policy_version;
  if not found then
    raise exception 'member_signup_approval_service_policy_missing';
  end if;

  select * into privacy_policy
  from public.policy_documents
  where id = request_row.privacy_policy_document_id
    and kind = 'privacy'
    and version = request_row.privacy_policy_version;
  if not found then
    raise exception 'member_signup_approval_privacy_policy_missing';
  end if;

  if request_row.marketing_policy_checked then
    select * into marketing_policy
    from public.policy_documents
    where id = request_row.marketing_policy_document_id
      and kind = 'marketing'
      and version = request_row.marketing_policy_version;
    if not found then
      raise exception 'member_signup_approval_marketing_policy_missing';
    end if;
  end if;

  agreed_at := request_row.consent_agreed_at;
  insert into public.members (
    mattermost_account_id,
    display_name,
    generation,
    staff_source_generation,
    campus,
    password_hash,
    password_salt,
    must_change_password,
    created_at,
    updated_at
  ) values (
    request_row.mattermost_account_id,
    btrim(p_display_name),
    p_generation,
    case when p_generation = 0 then request_row.sender_generation else null end,
    resolved_campus,
    request_row.password_hash,
    request_row.password_salt,
    false,
    now(),
    now()
  ) returning id into new_member_id;

  insert into public.member_policy_consents (
    member_id,
    policy_document_id,
    kind,
    version,
    agreed_at,
    ip_address,
    user_agent
  ) values
    (
      new_member_id,
      service_policy.id,
      service_policy.kind,
      service_policy.version,
      agreed_at,
      request_row.consent_ip_address,
      request_row.consent_user_agent
    ),
    (
      new_member_id,
      privacy_policy.id,
      privacy_policy.kind,
      privacy_policy.version,
      agreed_at,
      request_row.consent_ip_address,
      request_row.consent_user_agent
    );

  if request_row.marketing_policy_checked then
    insert into public.member_policy_consents (
      member_id,
      policy_document_id,
      kind,
      version,
      agreed_at,
      ip_address,
      user_agent
    ) values (
      new_member_id,
      marketing_policy.id,
      marketing_policy.kind,
      marketing_policy.version,
      agreed_at,
      request_row.consent_ip_address,
      request_row.consent_user_agent
    );
  end if;

  insert into public.push_preferences (
    member_id,
    marketing_enabled,
    updated_at
  ) values (
    new_member_id,
    request_row.marketing_policy_checked,
    now()
  )
  on conflict (member_id) do update
    set marketing_enabled = excluded.marketing_enabled,
        updated_at = now();

  update public.member_signup_approval_requests
  set status = 'approved',
      reviewed_by_admin_id = p_admin_id,
      reviewed_at = now(),
      password_hash = null,
      password_salt = null,
      updated_at = now()
  where id = request_row.id
    and status = 'pending';

  return jsonb_build_object(
    'status', 'approved',
    'member_id', new_member_id
  );
end;
$$;

create or replace function public.reject_member_signup_approval_request(
  p_request_id uuid,
  p_admin_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  request_row public.member_signup_approval_requests%rowtype;
  reason text;
begin
  if not exists (
    select 1
    from public.admin_profiles profile
    join public.members admin_member on admin_member.id = profile.member_id
    where profile.member_id = p_admin_id
      and profile.permission_template_key = 'super_admin'
      and profile.is_active = true
      and admin_member.deleted_at is null
  ) then
    raise exception 'member_signup_approval_super_admin_required';
  end if;

  reason := nullif(btrim(coalesce(p_reason, '')), '');
  if reason is null or char_length(reason) > 500 then
    raise exception 'member_signup_approval_rejection_reason_invalid';
  end if;

  select * into request_row
  from public.member_signup_approval_requests
  where id = p_request_id
  for update;

  if not found or request_row.status <> 'pending' then
    raise exception 'member_signup_approval_request_not_pending';
  end if;

  update public.member_signup_approval_requests
  set status = 'rejected',
      reviewed_by_admin_id = p_admin_id,
      reviewed_at = now(),
      rejection_reason = reason,
      password_hash = null,
      password_salt = null,
      updated_at = now()
  where id = request_row.id
    and status = 'pending';

  return jsonb_build_object('status', 'rejected');
end;
$$;

revoke all on function public.approve_member_signup_approval_request(uuid, uuid, text, integer, text) from public;
revoke all on function public.approve_member_signup_approval_request(uuid, uuid, text, integer, text) from anon;
revoke all on function public.approve_member_signup_approval_request(uuid, uuid, text, integer, text) from authenticated;
grant execute on function public.approve_member_signup_approval_request(uuid, uuid, text, integer, text) to service_role;
revoke all on function public.reject_member_signup_approval_request(uuid, uuid, text) from public;
revoke all on function public.reject_member_signup_approval_request(uuid, uuid, text) from anon;
revoke all on function public.reject_member_signup_approval_request(uuid, uuid, text) from authenticated;
grant execute on function public.reject_member_signup_approval_request(uuid, uuid, text) to service_role;
