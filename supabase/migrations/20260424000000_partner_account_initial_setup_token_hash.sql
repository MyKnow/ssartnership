alter table partner_accounts
  add column if not exists initial_setup_token_hash text;

alter table partner_accounts
  add column if not exists initial_setup_expires_at timestamp with time zone;

update partner_accounts
set initial_setup_token_hash = encode(digest(initial_setup_token, 'sha256'), 'hex')
where initial_setup_token is not null
  and initial_setup_token_hash is null;

drop index if exists partner_accounts_initial_setup_token_key;

create unique index if not exists partner_accounts_initial_setup_token_hash_key
  on partner_accounts(initial_setup_token_hash);

alter table partner_accounts
  drop column if exists initial_setup_token;
