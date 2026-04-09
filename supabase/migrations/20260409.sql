alter table members drop constraint if exists members_year_check;
alter table members add constraint members_year_check
  check (year between 0 and 99);
comment on column members.year is 'SSAFY year; 0 indicates staff';
alter table members add column if not exists staff_source_year integer;
comment on column members.staff_source_year is 'Original staff lookup year when members.year is 0';

alter table mm_verification_codes drop constraint if exists mm_verification_codes_year_check;
alter table mm_verification_codes add constraint mm_verification_codes_year_check
  check (year between 0 and 99);
comment on column mm_verification_codes.year is 'SSAFY year; 0 indicates staff';

alter table members drop column if exists class_number;
alter table mm_verification_codes drop column if exists class_number;
alter table push_message_logs drop column if exists target_class_number;
