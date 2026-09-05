begin;

-- Phase 1: preserve every existing request's generation before the old
-- period columns become nullable. A missing or invalid row must stop this
-- migration rather than inventing a cohort.
do $$
declare
  invalid_count integer;
begin
  select count(*) into invalid_count
  from public.graduate_verification_requests request
  where not (
    coalesce(request.inferred_generation between 1 and 99, false)
    or coalesce(request.inferred_cohort between 1 and 99, false)
    or (
      request.education_start_year is not null
      and request.education_start_month is not null
      and request.education_end_year is not null
      and request.education_end_month is not null
      and request.education_start_year * 12 + request.education_start_month >= 2018 * 12 + 12
      and request.education_start_month between 1 and 12
      and request.education_end_month between 1 and 12
      and request.education_end_year * 12 + request.education_end_month >= request.education_start_year * 12 + request.education_start_month
      and request.education_end_year * 12 + request.education_end_month <= extract(year from now())::integer * 12 + extract(month from now())::integer
      and (
        case
          when request.education_start_year = 2018 and request.education_start_month = 12 then 1
          when request.education_start_year >= 2019 then (request.education_start_year - 2019) * 2 + case when request.education_start_month >= 7 then 2 else 1 end
        end
      ) between 1 and least(99, (extract(year from now())::integer - 2019) * 2 + case when extract(month from now())::integer >= 7 then 2 else 1 end)
    )
  );
  if invalid_count > 0 then
    raise exception 'graduate_verification_generation_backfill_invalid_rows:%', invalid_count;
  end if;
end $$;

update public.graduate_verification_requests request
set inferred_generation = coalesce(
      case when request.inferred_generation between 1 and 99 then request.inferred_generation end,
      case when request.inferred_cohort between 1 and 99 then request.inferred_cohort end,
      case
        when request.education_start_year = 2018 and request.education_start_month = 12 then 1
        when request.education_start_year >= 2019
          then (request.education_start_year - 2019) * 2
            + case when request.education_start_month >= 7 then 2 else 1 end
      end
    ),
    inferred_cohort = coalesce(
      case when request.inferred_generation between 1 and 99 then request.inferred_generation end,
      case when request.inferred_cohort between 1 and 99 then request.inferred_cohort end,
      case
        when request.education_start_year = 2018 and request.education_start_month = 12 then 1
        when request.education_start_year >= 2019
          then (request.education_start_year - 2019) * 2
            + case when request.education_start_month >= 7 then 2 else 1 end
      end
    ),
    cohort_rule_version = coalesce(request.cohort_rule_version, 'ssafy-half-year-v1');

do $$
declare
  invalid_count integer;
begin
  select count(*) into invalid_count
  from public.graduate_verification_requests
  where not coalesce(inferred_generation between 1 and 99, false)
     or not coalesce(inferred_cohort between 1 and 99, false);
  if invalid_count > 0 then
    raise exception 'graduate_verification_generation_backfill_incomplete:%', invalid_count;
  end if;
end $$;

-- The old app remains deployable until Phase 2. Its validation constraints
-- remain in place; SQL CHECK treats NULL as passing for new generation-only rows.
alter table public.graduate_verification_requests
  alter column education_start_year drop not null,
  alter column education_start_month drop not null,
  alter column education_end_year drop not null,
  alter column education_end_month drop not null;

commit;
