create table if not exists partner_reviews (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  rating integer not null,
  title text not null,
  body text not null,
  images text[] not null default '{}',
  deleted_at timestamp with time zone,
  deleted_by_member_id uuid references members(id) on delete set null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table partner_reviews
  drop constraint if exists partner_reviews_rating_check;
alter table partner_reviews
  add constraint partner_reviews_rating_check
  check (rating between 1 and 5);

create index if not exists partner_reviews_partner_id_created_at_idx
  on partner_reviews(partner_id, deleted_at, created_at desc);

create index if not exists partner_reviews_partner_id_rating_desc_idx
  on partner_reviews(partner_id, deleted_at, rating desc, created_at desc);

create index if not exists partner_reviews_partner_id_rating_asc_idx
  on partner_reviews(partner_id, deleted_at, rating asc, created_at desc);

create index if not exists partner_reviews_member_id_partner_id_created_at_idx
  on partner_reviews(member_id, partner_id, deleted_at, created_at desc);

insert into storage.buckets (id, name, public)
values ('review-media', 'review-media', true)
on conflict (id) do update set public = excluded.public;

alter table partner_reviews enable row level security;

revoke all on table partner_reviews from anon;
revoke all on table partner_reviews from authenticated;
