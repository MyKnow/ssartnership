-- Add explicit benefit-level visibility separate from partner page visibility.
-- Rollback, if needed:
--   alter table public.partners drop constraint if exists partners_benefit_visibility_check;
--   alter table public.partners drop column if exists benefit_visibility;

alter table public.partners
  add column if not exists benefit_visibility text not null default 'public';

update public.partners
set benefit_visibility = case lower(trim(coalesce(benefit_visibility, 'public')))
  when 'eligible_only' then 'eligible_only'
  else 'public'
end;

alter table public.partners
  alter column benefit_visibility set default 'public';

alter table public.partners
  alter column benefit_visibility set not null;

alter table public.partners
  drop constraint if exists partners_benefit_visibility_check;

alter table public.partners
  add constraint partners_benefit_visibility_check
  check (benefit_visibility in ('public', 'eligible_only'));
