alter table public.partner_registration_requests
  add column if not exists benefit_verification_pin_hash text,
  add column if not exists benefit_verification_pin_salt text;

alter table public.partner_registration_requests
  drop constraint if exists partner_registration_requests_benefit_verification_pin_check;

alter table public.partner_registration_requests
  add constraint partner_registration_requests_benefit_verification_pin_check
  check (
    (benefit_verification_pin_hash is null and benefit_verification_pin_salt is null)
    or (
      char_length(benefit_verification_pin_hash) > 0
      and char_length(benefit_verification_pin_salt) > 0
    )
  );

comment on column public.partner_registration_requests.benefit_verification_pin_hash is
  'Admin-configured on-site benefit verification PIN hash. The raw PIN is never persisted.';

comment on column public.partner_registration_requests.benefit_verification_pin_salt is
  'Salt paired with the admin-configured on-site benefit verification PIN hash.';
