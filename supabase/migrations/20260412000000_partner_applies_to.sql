alter table partners add column if not exists applies_to text[] not null default '{staff,student,graduate}';
update partners
set applies_to = case
  when coalesce(cardinality(applies_to), 0) = 0 then array['staff', 'student', 'graduate']
  else applies_to
end;
alter table partners alter column applies_to set default '{staff,student,graduate}';
alter table partners alter column applies_to set not null;
alter table partners drop constraint if exists partners_applies_to_check;
alter table partners add constraint partners_applies_to_check
  check (
    cardinality(applies_to) > 0
    and applies_to <@ array['staff', 'student', 'graduate']::text[]
  );
alter table partners drop column if exists conditions;

