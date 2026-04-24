alter table partner_reviews
  add column if not exists hidden_at timestamp with time zone,
  add column if not exists hidden_by_admin_id text,
  add column if not exists hidden_by_partner_account_id uuid references partner_accounts(id) on delete set null;

update partner_reviews
set hidden_at = deleted_at,
    deleted_at = null,
    deleted_by_member_id = null
where deleted_at is not null
  and deleted_by_member_id is null
  and hidden_at is null;

drop index if exists partner_reviews_partner_id_created_at_idx;
drop index if exists partner_reviews_partner_id_rating_desc_idx;
drop index if exists partner_reviews_partner_id_rating_asc_idx;
drop index if exists partner_reviews_member_id_partner_id_created_at_idx;

create index if not exists partner_reviews_partner_id_created_at_idx
  on partner_reviews(partner_id, deleted_at, hidden_at, created_at desc);

create index if not exists partner_reviews_partner_id_rating_desc_idx
  on partner_reviews(partner_id, deleted_at, hidden_at, rating desc, created_at desc);

create index if not exists partner_reviews_partner_id_rating_asc_idx
  on partner_reviews(partner_id, deleted_at, hidden_at, rating asc, created_at desc);

create index if not exists partner_reviews_member_id_partner_id_created_at_idx
  on partner_reviews(member_id, partner_id, deleted_at, hidden_at, created_at desc);
