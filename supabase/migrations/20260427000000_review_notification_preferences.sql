alter table push_preferences
  add column if not exists review_enabled boolean not null default true;
