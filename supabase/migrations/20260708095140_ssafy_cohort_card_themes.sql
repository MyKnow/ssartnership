create table if not exists public.ssafy_cohort_card_themes (
  cohort_year integer primary key,
  display_name text,
  background_from text not null,
  background_via text not null,
  background_to text not null,
  accent_color text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint ssafy_cohort_card_themes_year_check check (cohort_year between 1 and 99),
  constraint ssafy_cohort_card_themes_display_name_check check (
    display_name is null or char_length(btrim(display_name)) between 1 and 40
  ),
  constraint ssafy_cohort_card_themes_background_from_check check (background_from ~ '^#[0-9a-f]{6}$'),
  constraint ssafy_cohort_card_themes_background_via_check check (background_via ~ '^#[0-9a-f]{6}$'),
  constraint ssafy_cohort_card_themes_background_to_check check (background_to ~ '^#[0-9a-f]{6}$'),
  constraint ssafy_cohort_card_themes_accent_color_check check (accent_color ~ '^#[0-9a-f]{6}$')
);

comment on table public.ssafy_cohort_card_themes is 'Admin-managed SSAFY cohort certification card palette values.';
comment on column public.ssafy_cohort_card_themes.cohort_year is 'SSAFY cohort number such as 16.';
comment on column public.ssafy_cohort_card_themes.display_name is 'Optional admin display label for the card theme.';
comment on column public.ssafy_cohort_card_themes.background_from is 'Certification card gradient start color in normalized #rrggbb format.';
comment on column public.ssafy_cohort_card_themes.background_via is 'Certification card gradient middle color in normalized #rrggbb format.';
comment on column public.ssafy_cohort_card_themes.background_to is 'Certification card gradient end color in normalized #rrggbb format.';
comment on column public.ssafy_cohort_card_themes.accent_color is 'Certification card accent color in normalized #rrggbb format.';

alter table public.ssafy_cohort_card_themes enable row level security;

revoke all on table public.ssafy_cohort_card_themes from anon;
revoke all on table public.ssafy_cohort_card_themes from authenticated;

insert into public.ssafy_cohort_card_themes (
  cohort_year,
  display_name,
  background_from,
  background_via,
  background_to,
  accent_color
)
values
  (14, '14기', '#07120d', '#0a1a15', '#111827', '#34d399'),
  (15, '15기', '#110c1f', '#1a1430', '#111827', '#a78bfa'),
  (16, '16기', '#062a3a', '#0f3b66', '#111827', '#38bdf8')
on conflict (cohort_year) do nothing;
