-- Add explicit benefit-use action metadata while keeping reservation_link as a compatibility column.
-- Rollback, if needed:
--   alter table public.partners drop constraint if exists partners_benefit_action_type_check;
--   alter table public.partners drop column if exists benefit_action_link;
--   alter table public.partners drop column if exists benefit_action_type;

alter table public.partners
  add column if not exists benefit_action_type text not null default 'none',
  add column if not exists benefit_action_link text;

update public.partners
set
  benefit_action_type = case
    when reservation_link is not null and trim(reservation_link) <> ''
      then 'external_link'
    when benefit_action_type in ('certification', 'external_link', 'onsite', 'none')
      then benefit_action_type
    else 'none'
  end,
  benefit_action_link = case
    when benefit_action_link is not null and trim(benefit_action_link) <> ''
      then benefit_action_link
    when reservation_link is not null and trim(reservation_link) <> ''
      then reservation_link
    else null
  end;

update public.partners
set benefit_action_link = null
where benefit_action_type <> 'external_link';

alter table public.partners
  drop constraint if exists partners_benefit_action_type_check;

alter table public.partners
  add constraint partners_benefit_action_type_check
  check (benefit_action_type in ('certification', 'external_link', 'onsite', 'none'));
