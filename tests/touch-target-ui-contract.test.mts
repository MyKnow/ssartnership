import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  TOUCH_TARGET_GROUP_GAP_CLASS_NAME,
  TOUCH_TARGET_HIT_AREA_CLASS_NAME,
} from "../src/components/ui/touch-target.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("소형 조작 요소 히트 영역은 중앙 정렬된 44×44 투명 의사요소다", () => {
  const tokens = TOUCH_TARGET_HIT_AREA_CLASS_NAME.split(" ");
  for (const token of [
    "relative",
    "before:absolute",
    "before:min-h-11",
    "before:min-w-11",
    "before:-translate-x-1/2",
    "before:-translate-y-1/2",
    "before:content-['']",
  ]) {
    assert.ok(tokens.includes(token), `${token} 누락`);
  }
  assert.ok(!tokens.some((token) => token.startsWith("before:bg-")));
  // 히트 영역 44px - 시각 32px = 좌우 6px씩. 인접 버튼은 12px 이상 떨어져야 겹치지 않는다.
  assert.equal(TOUCH_TARGET_GROUP_GAP_CLASS_NAME, "gap-3");
});

test("Button 기본 크기는 44px 최소 영역을 크기별로 갖고 compact만 시각 32px + 히트 영역을 쓴다", () => {
  const source = read("src/components/ui/Button.tsx");
  const base = source.match(/const base = cn\(\s*"([^"]+)"/)?.[1] ?? "";
  assert.ok(base.length > 0);
  assert.doesNotMatch(base, /min-h-11|min-w-11/, "base에 min-h-11이 있으면 compact가 ! 없이 줄어들 수 없다");
  for (const size of ["sm", "md", "lg", "icon"]) {
    assert.match(source, new RegExp(`\\b${size}: "[^"]*min-h-11[^"]*min-w-11`), `${size} 크기 44px 최소 영역`);
  }
  assert.match(
    source,
    /compact: cn\("h-8 rounded-full px-3 text-xs", TOUCH_TARGET_HIT_AREA_CLASS_NAME\)/,
  );
});

test("알림함 일괄 버튼과 제휴처 상세 즐겨찾기 수는 ! 크기 오버라이드 대신 compact를 쓴다", () => {
  for (const path of [
    "src/components/notifications/NotificationInbox.tsx",
    "src/components/admin/AdminNotificationInbox.tsx",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /!h-8|!min-h-8|!min-w-0/, `${path}: ! 크기 오버라이드 금지`);
    assert.equal(source.match(/size="compact"/g)?.length, 2, `${path}: 전체 읽음·전체 삭제 compact`);
  }
  const hero = read("src/app/(site)/partners/[id]/_page/PartnerDetailHeroContent.tsx");
  assert.match(hero, /<PartnerFavoriteCountLabel[\s\S]*?size="compact"[\s\S]*?\/>/);
  assert.doesNotMatch(hero, /className="!h-8 !min-w-0 !px-2 text-\[11px\]"/);
  assert.match(hero, /<IconActionGroup[\s\S]*?density="tight"/);
});

test("IconActionButton과 별점 입력은 44px 히트 영역과 공용 포커스 링을 갖는다", () => {
  const iconAction = read("src/components/ui/IconActionButton.tsx");
  assert.match(iconAction, /TOUCH_TARGET_HIT_AREA_CLASS_NAME,\s*FOCUS_RING_CLASS_NAME,/);
  assert.match(iconAction, /density === "tight" \? "gap-1" : TOUCH_TARGET_GROUP_GAP_CLASS_NAME/);

  const stars = read("src/components/partner-reviews/ReviewStarsInput.tsx");
  assert.match(stars, /"inline-flex h-11 w-11 items-center justify-center rounded-full/);
  assert.match(stars, /FOCUS_RING_CLASS_NAME/);
  assert.match(stars, /aria-pressed=\{rating === value\}/);
  assert.doesNotMatch(stars, /h-8 w-8/);
});
