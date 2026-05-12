-- Add optional long-form descriptions for public partner detail pages.
-- Rollback, if needed:
--   alter table public.partner_change_requests drop constraint if exists partner_change_requests_requested_detail_description_length_check;
--   alter table public.partner_change_requests drop constraint if exists partner_change_requests_current_detail_description_length_check;
--   alter table public.partner_change_requests drop column if exists requested_detail_description;
--   alter table public.partner_change_requests drop column if exists current_detail_description;
--   alter table public.partners drop constraint if exists partners_detail_description_length_check;
--   alter table public.partners drop column if exists detail_description;

alter table public.partners
  add column if not exists detail_description text;

alter table public.partners
  drop constraint if exists partners_detail_description_length_check;

alter table public.partners
  add constraint partners_detail_description_length_check
  check (
    detail_description is null
    or char_length(detail_description) <= 1200
  );

alter table public.partner_change_requests
  add column if not exists current_detail_description text,
  add column if not exists requested_detail_description text;

alter table public.partner_change_requests
  drop constraint if exists partner_change_requests_current_detail_description_length_check;

alter table public.partner_change_requests
  add constraint partner_change_requests_current_detail_description_length_check
  check (
    current_detail_description is null
    or char_length(current_detail_description) <= 1200
  );

alter table public.partner_change_requests
  drop constraint if exists partner_change_requests_requested_detail_description_length_check;

alter table public.partner_change_requests
  add constraint partner_change_requests_requested_detail_description_length_check
  check (
    requested_detail_description is null
    or char_length(requested_detail_description) <= 1200
  );
