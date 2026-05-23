alter table public.promotion_slides
  add column if not exists event_slug text references public.promotion_events(slug) on delete set null;

update public.promotion_slides as slide
set event_slug = event.slug
from public.promotion_events as event
where slide.event_slug is null
  and (
    slide.href = event.page_path
    or slide.href = '/events/' || event.slug
  );

create index if not exists promotion_slides_event_slug_idx
  on public.promotion_slides(event_slug);

create table if not exists public.event_reward_draws (
  id uuid primary key default uuid_generate_v4(),
  event_slug text not null references public.promotion_events(slug) on delete cascade,
  status text not null default 'draft',
  seed text not null,
  winner_count integer not null,
  candidate_count integer not null default 0,
  total_tickets integer not null default 0,
  google_form_url text not null,
  guide_path text not null,
  sent_notification_id uuid references public.notifications(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_admin_id text,
  created_at timestamp with time zone not null default now(),
  finalized_at timestamp with time zone,
  sent_at timestamp with time zone,
  updated_at timestamp with time zone not null default now(),
  constraint event_reward_draws_status_check
    check (status in ('draft', 'finalized', 'sent', 'partial_failed', 'failed')),
  constraint event_reward_draws_winner_count_check
    check (winner_count > 0),
  constraint event_reward_draws_candidate_count_check
    check (candidate_count >= 0),
  constraint event_reward_draws_total_tickets_check
    check (total_tickets >= 0),
  constraint event_reward_draws_google_form_url_check
    check (google_form_url like 'https://%'),
  constraint event_reward_draws_guide_path_check
    check (guide_path like '/%' and guide_path not like '//%')
);

comment on table public.event_reward_draws is
  'Admin-created weighted reward event draws. One finalized draw is allowed per event.';

create unique index if not exists event_reward_draws_one_finalized_per_event_idx
  on public.event_reward_draws(event_slug)
  where status in ('finalized', 'sent', 'partial_failed', 'failed');

create index if not exists event_reward_draws_event_created_at_idx
  on public.event_reward_draws(event_slug, created_at desc);

create table if not exists public.event_reward_winners (
  id uuid primary key default uuid_generate_v4(),
  draw_id uuid not null references public.event_reward_draws(id) on delete cascade,
  event_slug text not null references public.promotion_events(slug) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  winner_rank integer not null,
  ticket_count integer not null,
  display_name text,
  mm_username text,
  year integer,
  campus text,
  notification_status text not null default 'pending',
  notification_sent_at timestamp with time zone,
  notification_error text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint event_reward_winners_rank_check
    check (winner_rank > 0),
  constraint event_reward_winners_ticket_count_check
    check (ticket_count > 0),
  constraint event_reward_winners_notification_status_check
    check (notification_status in ('pending', 'sent', 'partial_failed', 'failed', 'skipped')),
  constraint event_reward_winners_draw_member_key unique (draw_id, member_id),
  constraint event_reward_winners_draw_rank_key unique (draw_id, winner_rank)
);

comment on table public.event_reward_winners is
  'Persisted winners for reward event draws and notification delivery status.';

create index if not exists event_reward_winners_event_member_idx
  on public.event_reward_winners(event_slug, member_id);

create index if not exists event_reward_winners_draw_rank_idx
  on public.event_reward_winners(draw_id, winner_rank);

create or replace function public.set_event_reward_draws_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_reward_draws_set_updated_at on public.event_reward_draws;
create trigger event_reward_draws_set_updated_at
before update on public.event_reward_draws
for each row
execute function public.set_event_reward_draws_updated_at();

create or replace function public.set_event_reward_winners_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_reward_winners_set_updated_at on public.event_reward_winners;
create trigger event_reward_winners_set_updated_at
before update on public.event_reward_winners
for each row
execute function public.set_event_reward_winners_updated_at();

alter table public.event_reward_draws enable row level security;
alter table public.event_reward_winners enable row level security;

revoke all on table public.event_reward_draws from anon;
revoke all on table public.event_reward_draws from authenticated;
revoke all on table public.event_reward_winners from anon;
revoke all on table public.event_reward_winners from authenticated;
