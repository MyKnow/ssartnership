create table if not exists promotion_events (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  title text not null,
  short_title text not null,
  description text not null,
  period_label text not null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone not null,
  hero_image_src text not null,
  hero_image_alt text not null,
  conditions jsonb not null default '[]'::jsonb,
  rules jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint promotion_events_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint promotion_events_period_check
    check (starts_at <= ends_at),
  constraint promotion_events_conditions_array_check
    check (jsonb_typeof(conditions) = 'array'),
  constraint promotion_events_rules_array_check
    check (jsonb_typeof(rules) = 'array')
);

comment on table promotion_events is
  'Admin-managed public event landing pages and home promotion carousel event entries.';

create index if not exists promotion_events_active_period_idx
  on promotion_events(is_active, starts_at desc, ends_at desc);

create index if not exists promotion_events_updated_at_idx
  on promotion_events(updated_at desc);

create or replace function set_promotion_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists promotion_events_set_updated_at on promotion_events;
create trigger promotion_events_set_updated_at
before update on promotion_events
for each row
execute function set_promotion_events_updated_at();

insert into promotion_events (
  slug,
  title,
  short_title,
  description,
  period_label,
  starts_at,
  ends_at,
  hero_image_src,
  hero_image_alt,
  conditions,
  rules,
  is_active
) values (
  'signup-reward',
  '싸트너십 추첨권 이벤트',
  '추첨권 이벤트',
  '회원가입, 알림 채널 활성화, 마케팅/이벤트 수신 동의, 신규 리뷰 작성으로 추첨권을 받을 수 있습니다.',
  '이벤트 종료 시점 기준으로 조건이 유지되어야 인정됩니다.',
  '2026-04-20 00:00:00+09',
  '2026-05-12 23:59:59+09',
  '/ads/reward-event.svg',
  '싸트너십 회원 참여 추첨권 이벤트',
  '[
    {
      "key": "signup",
      "title": "싸트너십 회원가입",
      "description": "이벤트 기간 내 신규 가입 시 추첨권 1장을 지급합니다.",
      "tickets": 1,
      "ctaHref": "/auth/signup",
      "ctaLabel": "회원가입"
    },
    {
      "key": "mm",
      "title": "Mattermost 알림 채널",
      "description": "Mattermost 알림 채널 활성화 시 추첨권 1장을 지급합니다.",
      "tickets": 1,
      "ctaHref": "/notifications",
      "ctaLabel": "알림 설정"
    },
    {
      "key": "push",
      "title": "푸시 알림",
      "description": "브라우저 푸시 알림 활성화 시 추첨권 1장을 지급합니다.",
      "tickets": 1,
      "ctaHref": "/notifications",
      "ctaLabel": "푸시 켜기"
    },
    {
      "key": "marketing",
      "title": "마케팅/이벤트 수신 동의",
      "description": "마케팅/이벤트 수신 동의 유지 시 추첨권 2장을 지급합니다.",
      "tickets": 2,
      "ctaHref": "/notifications",
      "ctaLabel": "동의하러 가기"
    },
    {
      "key": "review",
      "title": "신규 리뷰 작성",
      "description": "이벤트 기간 내 신규 리뷰 작성 시 리뷰 1개당 추첨권 1장을 지급합니다.",
      "tickets": 1,
      "ctaHref": "/#partner-explore",
      "ctaLabel": "리뷰 작성",
      "repeatable": true
    }
  ]'::jsonb,
  '[
    "모든 조건은 이벤트 종료 시점 기준으로 유지되어 있어야 인정됩니다.",
    "알림 채널 해제, 마케팅/이벤트 수신 해제, 리뷰 삭제 시 해당 추첨권은 차감됩니다.",
    "무성의한 리뷰, 동일 문구 반복, 광고성 리뷰, 운영 취지에 맞지 않는 리뷰는 운영진 판단에 따라 인정 제외될 수 있습니다.",
    "당첨은 1인 1회로 제한됩니다."
  ]'::jsonb,
  true
) on conflict (slug) do update set
  title = excluded.title,
  short_title = excluded.short_title,
  description = excluded.description,
  period_label = excluded.period_label,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  hero_image_src = excluded.hero_image_src,
  hero_image_alt = excluded.hero_image_alt,
  conditions = excluded.conditions,
  rules = excluded.rules,
  is_active = excluded.is_active;
