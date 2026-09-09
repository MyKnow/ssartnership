begin;

-- Phase 2 runs only after the generation-only app is verified. Do not discard
-- the legacy period data unless Phase 1 produced one valid, matching cohort
-- value in both compatibility columns for every request.
do $$
declare
  invalid_count integer;
begin
  select count(*) into invalid_count
  from public.graduate_verification_requests
  where not (
    coalesce(inferred_generation between 1 and 99, false)
    and coalesce(inferred_cohort between 1 and 99, false)
    and inferred_generation = inferred_cohort
  );

  if invalid_count > 0 then
    raise exception 'graduate_verification_cohort_cutover_invalid_rows:%', invalid_count;
  end if;
end $$;

alter table public.graduate_verification_requests
  alter column inferred_generation set not null,
  drop constraint graduate_verification_requests_period_check,
  drop constraint graduate_verification_requests_start_month_check,
  drop constraint graduate_verification_requests_end_month_check,
  drop column education_start_year restrict,
  drop column education_start_month restrict,
  drop column education_end_year restrict,
  drop column education_end_month restrict;

commit;
