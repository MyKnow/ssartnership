alter table partners add column if not exists thumbnail text;

insert into storage.buckets (id, name, public)
values ('partner-media', 'partner-media', true)
on conflict (id) do update set public = excluded.public;
