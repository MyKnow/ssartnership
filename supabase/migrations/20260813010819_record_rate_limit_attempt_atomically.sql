create or replace function public.record_rate_limit_attempt(
  p_table_name text,
  p_identifier text,
  p_success boolean,
  p_window_ms bigint,
  p_max_attempts integer,
  p_block_ms bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recorded_at timestamp with time zone := clock_timestamp();
begin
  if p_table_name is null or p_table_name not in (
    'admin_login_attempts',
    'member_auth_attempts',
    'mattermost_sender_test_attempts',
    'partner_auth_attempts',
    'partner_registration_attempts',
    'suggestion_attempts'
  ) then
    raise exception using
      errcode = '22023',
      message = 'rate_limit_table_invalid';
  end if;

  if p_identifier is null
     or btrim(p_identifier) = ''
     or char_length(p_identifier) > 512 then
    raise exception using
      errcode = '22023',
      message = 'rate_limit_identifier_invalid';
  end if;

  if p_success is null
     or p_window_ms is null
     or p_window_ms < 1
     or p_window_ms > 2592000000
     or p_max_attempts is null
     or p_max_attempts < 1
     or p_max_attempts > 10000
     or p_block_ms is null
     or p_block_ms < 1
     or p_block_ms > 2592000000 then
    raise exception using
      errcode = '22023',
      message = 'rate_limit_policy_invalid';
  end if;

  if p_success then
    execute format(
      'delete from public.%I where identifier = $1',
      p_table_name
    ) using p_identifier;
    return;
  end if;

  execute format(
    $statement$
      insert into public.%1$I as attempt (
        identifier,
        count,
        first_attempt_at,
        blocked_until
      )
      values (
        $1,
        1,
        $2,
        case
          when $4 <= 1
            then $2 + ($5::double precision * interval '1 millisecond')
          else null
        end
      )
      on conflict (identifier) do update
      set
        count = case
          when $2 - attempt.first_attempt_at
               > ($3::double precision * interval '1 millisecond')
            then 1
          else attempt.count + 1
        end,
        first_attempt_at = case
          when $2 - attempt.first_attempt_at
               > ($3::double precision * interval '1 millisecond')
            then $2
          else attempt.first_attempt_at
        end,
        blocked_until = case
          when $2 - attempt.first_attempt_at
               > ($3::double precision * interval '1 millisecond')
            then case
              when $4 <= 1
                then $2 + ($5::double precision * interval '1 millisecond')
              else null
            end
          when attempt.count + 1 >= $4
            then greatest(
              coalesce(
                attempt.blocked_until,
                '-infinity'::timestamp with time zone
              ),
              pg_catalog.clock_timestamp()
                + ($5::double precision * interval '1 millisecond')
            )
          else attempt.blocked_until
        end
    $statement$,
    p_table_name
  ) using
    p_identifier,
    recorded_at,
    p_window_ms,
    p_max_attempts,
    p_block_ms;
end;
$$;

revoke all on function public.record_rate_limit_attempt(text, text, boolean, bigint, integer, bigint) from public;
revoke all on function public.record_rate_limit_attempt(text, text, boolean, bigint, integer, bigint) from anon;
revoke all on function public.record_rate_limit_attempt(text, text, boolean, bigint, integer, bigint) from authenticated;
grant execute on function public.record_rate_limit_attempt(text, text, boolean, bigint, integer, bigint) to service_role;
