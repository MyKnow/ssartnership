revoke execute on function public.expire_pending_member_signup_approval_requests(timestamp with time zone)
  from service_role;
drop function if exists public.expire_pending_member_signup_approval_requests(timestamp with time zone);

create function public.expire_pending_member_signup_approval_requests(
  p_now timestamp with time zone default now(),
  p_limit integer default 100
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
    select request.id,
           request.profile_image_upload_id,
           upload.owner_id as profile_image_owner_id
    from public.member_signup_approval_requests request
    left join public.image_upload_sessions upload
      on upload.id = request.profile_image_upload_id
     and upload.owner_kind = 'signup'
     and upload.purpose = 'member-signup-profile'
     and upload.role = 'profile'
    where request.status = 'pending'
      and request.expires_at <= p_now
    order by request.expires_at asc
    limit least(greatest(coalesce(p_limit, 100), 1), 100)
    for update of request skip locked
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
        'profile_image_upload_id', request_row.profile_image_upload_id,
        'profile_image_owner_id', request_row.profile_image_owner_id
      ));
    end if;
  end loop;
  return expired_requests;
end;
$$;

revoke all on function public.expire_pending_member_signup_approval_requests(timestamp with time zone, integer)
  from public;
revoke all on function public.expire_pending_member_signup_approval_requests(timestamp with time zone, integer)
  from anon;
revoke all on function public.expire_pending_member_signup_approval_requests(timestamp with time zone, integer)
  from authenticated;
grant execute on function public.expire_pending_member_signup_approval_requests(timestamp with time zone, integer)
  to service_role;
