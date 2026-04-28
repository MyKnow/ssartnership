begin;

create extension if not exists pgcrypto;

alter table public.partner_accounts
  add column if not exists initial_setup_token_hash text;

alter table public.partner_accounts
  add column if not exists initial_setup_verification_code_hash text;

alter table public.partner_accounts
  add column if not exists initial_setup_link_sent_at timestamp with time zone;

alter table public.partner_accounts
  add column if not exists initial_setup_expires_at timestamp with time zone;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'partner_accounts'
      and column_name = 'initial_setup_token'
  ) then
    execute $sql$
      update public.partner_accounts
      set initial_setup_token_hash = encode(digest(initial_setup_token, 'sha256'), 'hex')
      where initial_setup_token is not null
        and initial_setup_token_hash is null
    $sql$;
  end if;
end
$$;

drop index if exists public.partner_accounts_initial_setup_token_key;

create unique index if not exists partner_accounts_initial_setup_token_hash_key
  on public.partner_accounts(initial_setup_token_hash);

alter table public.partner_accounts
  drop column if exists initial_setup_token;

commit;
