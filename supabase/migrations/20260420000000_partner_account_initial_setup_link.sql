alter table partner_accounts
  add column if not exists initial_setup_token text;

alter table partner_accounts
  add column if not exists initial_setup_verification_code_hash text;

alter table partner_accounts
  add column if not exists initial_setup_link_sent_at timestamp with time zone;

create unique index if not exists partner_accounts_initial_setup_token_key
  on partner_accounts(initial_setup_token);
