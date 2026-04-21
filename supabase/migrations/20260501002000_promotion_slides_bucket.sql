insert into storage.buckets (id, name, public)
values ('promotion-slides', 'promotion-slides', true)
on conflict (id) do update set public = excluded.public;
