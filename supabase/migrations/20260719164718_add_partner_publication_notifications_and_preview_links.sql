create table if not exists public.partner_publication_notification_states (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  new_partner_notification_sent_at timestamp with time zone,
  updated_at timestamp with time zone not null default now()
);

create index if not exists partner_publication_notification_pending_idx
  on public.partner_publication_notification_states(new_partner_notification_sent_at)
  where new_partner_notification_sent_at is null;

-- Existing active public partners have already been available to members. Only
-- partners that become public after this migration should be eligible for a new
-- automatic notification.
insert into public.partner_publication_notification_states (
  partner_id,
  new_partner_notification_sent_at
)
select
  id,
  coalesce(updated_at, created_at, now())
from public.partners
where visibility = 'public'
  and (
    period_start is null
    or period_start <= (now() at time zone 'Asia/Seoul')::date
  )
on conflict (partner_id) do nothing;

create table if not exists public.partner_preview_tokens (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamp with time zone not null default now()
);

alter table public.partner_publication_notification_states enable row level security;
alter table public.partner_preview_tokens enable row level security;

revoke all on table public.partner_publication_notification_states from anon;
revoke all on table public.partner_publication_notification_states from authenticated;
revoke all on table public.partner_preview_tokens from anon;
revoke all on table public.partner_preview_tokens from authenticated;
