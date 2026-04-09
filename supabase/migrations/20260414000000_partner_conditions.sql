alter table partners add column if not exists conditions text[] not null default '{}';

update partners
set conditions = array[]::text[]
where conditions is null;

comment on column partners.conditions is 'Usage conditions for partner benefits';
