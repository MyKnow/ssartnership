create or replace function public.enforce_member_profile_image_status_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'pending' and new.status in ('approved', 'rejected', 'superseded'))
    or (old.status = 'approved' and new.status in ('superseded', 'rejected'))
  ) then
    raise exception 'invalid_member_profile_image_status_transition';
  end if;

  return new;
end;
$$;
