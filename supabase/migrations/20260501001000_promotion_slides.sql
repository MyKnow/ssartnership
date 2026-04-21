create table if not exists public.promotion_slides (
  id uuid primary key default extensions.uuid_generate_v4(),
  display_order integer not null,
  title text not null,
  subtitle text not null,
  image_src text not null,
  image_alt text not null,
  href text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promotion_slides_active_order_idx
  on public.promotion_slides (is_active, display_order, created_at);

create or replace function public.set_promotion_slides_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists promotion_slides_set_updated_at on public.promotion_slides;

create trigger promotion_slides_set_updated_at
before update on public.promotion_slides
for each row
execute function public.set_promotion_slides_updated_at();

insert into public.promotion_slides (
  display_order,
  title,
  subtitle,
  image_src,
  image_alt,
  href,
  is_active
)
values
  (
    1,
    '싸트너십 | SSAFY 제휴 혜택 플랫폼',
    'SSAFY 구성원을 위한 캠퍼스 주변 제휴 혜택을 카테고리별로 빠르게 찾습니다.',
    '/ads/home-partnership-overview.svg',
    'SSAFY 제휴 혜택을 한곳에서 확인하는 광고',
    '/#partner-explore',
    true
  ),
  (
    2,
    '싸트너십 추첨권 이벤트',
    '회원가입, 알림 설정, 리뷰 작성으로 추첨권을 받을 수 있습니다.',
    '/ads/reward-event.svg',
    '회원가입, 알림, 마케팅 동의, 리뷰 작성 추첨권 이벤트 광고',
    '/events/signup-reward',
    true
  ),
  (
    3,
    '캠퍼스별 제휴 탐색',
    '서울 캠퍼스부터 캠퍼스별 제휴 혜택을 따로 확인합니다.',
    '/ads/campus-partners.svg',
    '캠퍼스별 제휴 혜택 탐색 광고',
    '/campuses/seoul',
    true
  )
on conflict do nothing;
