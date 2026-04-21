alter table public.promotion_slides
  add column if not exists audiences text[] not null default array['guest', 'student', 'graduate', 'staff']::text[];

update public.promotion_slides
set audiences = case
  when coalesce(cardinality(audiences), 0) = 0 then array['guest', 'student', 'graduate', 'staff']::text[]
  else audiences
end;
