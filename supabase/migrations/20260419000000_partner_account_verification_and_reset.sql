alter table partner_accounts
  add column if not exists email_verified_at timestamp with time zone;

alter table partner_accounts
  add column if not exists initial_setup_completed_at timestamp with time zone;
