create table if not exists partner_favorites (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_favorites_partner_id_member_id_key unique (partner_id, member_id)
);

create index if not exists partner_favorites_partner_id_idx
  on partner_favorites(partner_id);

create index if not exists partner_favorites_member_id_created_at_idx
  on partner_favorites(member_id, created_at desc);

alter table partner_favorites enable row level security;

revoke all on table partner_favorites from anon;
revoke all on table partner_favorites from authenticated;
