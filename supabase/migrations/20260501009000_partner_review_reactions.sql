create table if not exists partner_review_reactions (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references partner_reviews(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  reaction text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint partner_review_reactions_reaction_check check (reaction in ('recommend', 'disrecommend')),
  constraint partner_review_reactions_review_id_member_id_key unique (review_id, member_id)
);

create index if not exists partner_review_reactions_review_id_idx
  on partner_review_reactions(review_id, reaction);

create index if not exists partner_review_reactions_member_id_idx
  on partner_review_reactions(member_id, review_id);

alter table partner_review_reactions enable row level security;

revoke all on table partner_review_reactions from anon;
revoke all on table partner_review_reactions from authenticated;

