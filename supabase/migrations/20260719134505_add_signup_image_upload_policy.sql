-- 신규 회원가입 이미지 업로드는 일반 guest/member 업로드와 분리한다.
-- Mattermost 사용자 ID는 업로드 소유자로 저장하지 않고, 서명된 가입 세션에
-- 기록된 일회성 랜덤 UUID만 저장한다.
alter table public.image_upload_sessions
  drop constraint if exists image_upload_sessions_owner_kind_check;
alter table public.image_upload_sessions
  add constraint image_upload_sessions_owner_kind_check
  check (owner_kind in ('admin', 'member', 'partner', 'graduate_challenge', 'guest', 'signup'));

alter table public.image_upload_sessions
  drop constraint if exists image_upload_sessions_purpose_check;
alter table public.image_upload_sessions
  add constraint image_upload_sessions_purpose_check
  check (purpose in (
    'partner', 'partner-registration', 'partner-change-request', 'review',
    'profile', 'member-signup-profile', 'graduate-verification',
    'manual-member-import', 'promotion'
  ));

alter table public.member_signup_approval_requests
  add column if not exists profile_image_upload_id uuid
    references public.image_upload_sessions(id) on delete set null,
  add column if not exists expires_at timestamp with time zone
    not null default (now() + interval '7 days');

alter table public.member_signup_approval_requests
  drop constraint if exists member_signup_approval_requests_review_check;
alter table public.member_signup_approval_requests
  add constraint member_signup_approval_requests_review_check
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
      and reviewed_at is not null
      and (
        (
          reviewed_by_admin_id is not null
          and char_length(btrim(coalesce(rejection_reason, ''))) between 1 and 500
        )
        or (
          reviewed_by_admin_id is null
          and rejection_reason = 'approval_timeout'
        )
      )
    )
  );

create unique index if not exists member_signup_approval_requests_profile_image_upload_idx
  on public.member_signup_approval_requests(profile_image_upload_id)
  where profile_image_upload_id is not null;
create index if not exists member_signup_approval_requests_expiry_idx
  on public.member_signup_approval_requests(status, expires_at)
  where status = 'pending';

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
  image_upload_row public.image_upload_sessions%rowtype;
  profile_image_id uuid;
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
  if request_row.expires_at <= now() then
    raise exception 'member_signup_approval_request_expired';
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

  if request_row.profile_image_upload_id is not null then
    select * into image_upload_row
    from public.image_upload_sessions
    where id = request_row.profile_image_upload_id
    for update;
    if not found
      or image_upload_row.owner_kind <> 'signup'
      or image_upload_row.purpose <> 'member-signup-profile'
      or image_upload_row.role <> 'profile'
      or image_upload_row.status <> 'attached'
      or image_upload_row.content_type <> 'image/webp'
      or image_upload_row.width <> 640
      or image_upload_row.height <> 640
      or image_upload_row.sha256 is null
      or image_upload_row.final_bucket is null
      or image_upload_row.final_bucket <> 'member-profile-images'
      or image_upload_row.final_path is null
      or image_upload_row.final_path <> format('members/signup-approvals/%s.webp', request_row.id) then
      raise exception 'member_signup_approval_profile_image_invalid';
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

  if request_row.profile_image_upload_id is not null then
    insert into public.member_profile_images (
      member_id,
      storage_path,
      sha256,
      content_type,
      width,
      height,
      source,
      status,
      reviewed_at,
      created_at,
      updated_at
    ) values (
      new_member_id,
      image_upload_row.final_path,
      image_upload_row.sha256,
      'image/webp',
      640,
      640,
      'mattermost',
      'approved',
      now(),
      now(),
      now()
    ) returning id into profile_image_id;

    update public.members
    set active_profile_image_id = profile_image_id,
        profile_photo_review_status = 'approved',
        updated_at = now()
    where id = new_member_id;
  end if;

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

create or replace function public.expire_pending_member_signup_approval_requests(
  p_now timestamp with time zone default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  request_row record;
  expired_requests jsonb := '[]'::jsonb;
begin
  for request_row in
    select id, profile_image_upload_id
    from public.member_signup_approval_requests
    where status = 'pending'
      and expires_at <= p_now
    order by expires_at asc
    for update skip locked
  loop
    update public.member_signup_approval_requests
    set status = 'rejected',
        reviewed_by_admin_id = null,
        reviewed_at = p_now,
        rejection_reason = 'approval_timeout',
        password_hash = null,
        password_salt = null,
        updated_at = p_now
    where id = request_row.id
      and status = 'pending'
      and expires_at <= p_now;

    if found then
      expired_requests := expired_requests || jsonb_build_array(jsonb_build_object(
        'request_id', request_row.id,
        'profile_image_upload_id', request_row.profile_image_upload_id
      ));
    end if;
  end loop;
  return expired_requests;
end;
$$;

revoke all on function public.approve_member_signup_approval_request(uuid, uuid, text, integer, text) from public;
revoke all on function public.approve_member_signup_approval_request(uuid, uuid, text, integer, text) from anon;
revoke all on function public.approve_member_signup_approval_request(uuid, uuid, text, integer, text) from authenticated;
grant execute on function public.approve_member_signup_approval_request(uuid, uuid, text, integer, text) to service_role;
revoke all on function public.expire_pending_member_signup_approval_requests(timestamp with time zone) from public;
revoke all on function public.expire_pending_member_signup_approval_requests(timestamp with time zone) from anon;
revoke all on function public.expire_pending_member_signup_approval_requests(timestamp with time zone) from authenticated;
grant execute on function public.expire_pending_member_signup_approval_requests(timestamp with time zone) to service_role;
