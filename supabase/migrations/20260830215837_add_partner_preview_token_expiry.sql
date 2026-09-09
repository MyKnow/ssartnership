alter table public.partner_preview_tokens
  add column if not exists expires_at timestamp with time zone;

update public.partner_preview_tokens
set expires_at = created_at + interval '72 hours'
where expires_at is null;

alter table public.partner_preview_tokens
  alter column expires_at set not null;

alter table public.partner_preview_tokens
  drop constraint if exists partner_preview_tokens_expires_after_create_check;
alter table public.partner_preview_tokens
  add constraint partner_preview_tokens_expires_after_create_check
  check (expires_at > created_at);

create index if not exists partner_preview_tokens_expires_at_idx
  on public.partner_preview_tokens(expires_at);
