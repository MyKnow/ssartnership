create table if not exists ssafy_cycle_settings (
  id integer primary key default 1,
  anchor_year integer not null default 14,
  anchor_calendar_year integer not null default 2025,
  anchor_month integer not null default 7,
  manual_current_year integer,
  manual_reason text,
  manual_applied_at timestamp with time zone,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint ssafy_cycle_settings_singleton_check check (id = 1)
);

alter table ssafy_cycle_settings add column if not exists anchor_year integer not null default 14;
alter table ssafy_cycle_settings add column if not exists anchor_calendar_year integer not null default 2025;
alter table ssafy_cycle_settings add column if not exists anchor_month integer not null default 7;
alter table ssafy_cycle_settings add column if not exists manual_current_year integer;
alter table ssafy_cycle_settings add column if not exists manual_reason text;
alter table ssafy_cycle_settings add column if not exists manual_applied_at timestamp with time zone;
alter table ssafy_cycle_settings add column if not exists created_at timestamp with time zone default now();
alter table ssafy_cycle_settings add column if not exists updated_at timestamp with time zone default now();
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_singleton_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_singleton_check check (id = 1);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_anchor_year_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_anchor_year_check check (anchor_year between 1 and 99);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_anchor_calendar_year_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_anchor_calendar_year_check check (anchor_calendar_year between 2000 and 3000);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_anchor_month_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_anchor_month_check check (anchor_month between 1 and 12);
alter table ssafy_cycle_settings drop constraint if exists ssafy_cycle_settings_manual_current_year_check;
alter table ssafy_cycle_settings add constraint ssafy_cycle_settings_manual_current_year_check
  check (manual_current_year is null or manual_current_year between 0 and 99);

insert into ssafy_cycle_settings (
  id,
  anchor_year,
  anchor_calendar_year,
  anchor_month
)
values (1, 14, 2025, 7)
on conflict (id) do update set
  anchor_year = excluded.anchor_year,
  anchor_calendar_year = excluded.anchor_calendar_year,
  anchor_month = excluded.anchor_month,
  updated_at = now();
