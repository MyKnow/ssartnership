alter table public.promotion_events
  add column if not exists page_path text not null default '';

alter table public.promotion_events
  add column if not exists target_audiences text[] not null default array['guest', 'student', 'graduate', 'staff']::text[];

update public.promotion_events
set page_path = case
  when coalesce(page_path, '') = '' then '/events/' || slug
  else page_path
end;

update public.promotion_events
set target_audiences = case
  when coalesce(cardinality(target_audiences), 0) = 0 then array['guest', 'student', 'graduate', 'staff']::text[]
  else target_audiences
end;
