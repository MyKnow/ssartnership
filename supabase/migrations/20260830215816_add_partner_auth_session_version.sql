alter table public.partner_accounts
  add column if not exists auth_session_version integer not null default 1;

update public.partner_accounts
set auth_session_version = 1
where auth_session_version < 1;

alter table public.partner_accounts
  drop constraint if exists partner_accounts_auth_session_version_check;

alter table public.partner_accounts
  add constraint partner_accounts_auth_session_version_check
  check (auth_session_version >= 1);
