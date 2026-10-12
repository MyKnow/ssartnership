import assert from "node:assert/strict";
import test from "node:test";
import type { ShowcaseEvent } from "../src/lib/project-showcase/types";

const results = await import(new URL("../src/lib/project-showcase/results.ts", import.meta.url).href) as typeof import("../src/lib/project-showcase/results");
const promotions = await import(new URL("../src/lib/promotions/showcase-results.ts", import.meta.url).href) as typeof import("../src/lib/promotions/showcase-results");

const event: ShowcaseEvent = {
  id: "event", slug: "project-showcase", title: "쇼케이스", description: "", heroImageSrc: "",
  submissionStartAt: "2026-09-26T20:00:00+09:00", submissionEndAt: "2026-09-30T18:00:00+09:00",
  experienceStartAt: "2026-10-01T09:01:00+09:00", experienceEndAt: "2026-10-08T12:30:00+09:00",
  announcementStartAt: "2026-10-08T16:00:00+09:00", announcementEndAt: "2026-10-12T18:00:00+09:00",
  submitterSelectionCount: 19, experiencerSelectionCount: 30, isActive: false,
};

test("비활성 이벤트도 발표 이후에는 읽기 전용 결과를 제공한다", () => {
  assert.equal(results.canReadShowcaseResults(event, new Date("2026-10-08T15:59:59+09:00")), false);
  assert.equal(results.canReadShowcaseResults(event, new Date("2026-10-08T16:00:00+09:00")), true);
  assert.equal(results.canReadShowcaseResults(event, new Date("2026-10-15T00:00:00+09:00")), true);
  assert.equal(results.canReadShowcaseResults(null), false);
  assert.equal(results.canReadShowcaseResults({ ...event, experienceEndAt: "invalid" }), false);
  assert.equal(results.canReadShowcaseResults({ ...event, announcementStartAt: null }), false);
  assert.equal(results.canReadShowcaseResults({ ...event, experienceEndAt: "2026-11-01T00:00:00+09:00" }, new Date("2026-10-12T00:00:00+09:00")), false);
});

test("당첨 분야별 수령 폼을 연결하고 마감 정각부터 링크를 제거한다", () => {
  const before = new Date("2026-10-14T17:59:59.999+09:00");
  assert.deepEqual(results.getShowcasePrizeClaim("submitter", null, before), { status: "open", formUrl: "https://forms.gle/wx6z6fqeNyQ4B8JWA" });
  assert.deepEqual(results.getShowcasePrizeClaim("experiencer", null, before), { status: "open", formUrl: "https://forms.gle/PuhroAvV6Apw51C68" });
  for (const now of ["2026-10-14T18:00:00+09:00", "2026-10-15T00:00:00+09:00"]) {
    assert.deepEqual(results.getShowcasePrizeClaim("submitter", null, new Date(now)), { status: "closed", formUrl: null });
  }
  assert.deepEqual(results.getShowcasePrizeClaim("submitter", "2026-10-12T10:00:00+09:00", before), { status: "delivered", formUrl: null });
  assert.deepEqual(results.getShowcasePrizeClaim("invalid" as never, null, before), { status: "closed", formUrl: null });
  assert.deepEqual(results.getShowcasePrizeClaim("submitter", null, new Date("invalid")), { status: "closed", formUrl: null });
});

test("종료 결과 배너를 첫 번째로 배치하고 입력 배열·다른 배너를 보존한다", () => {
  const slides = [
    { id: "other", href: "/other", title: "다른 안내", description: "기존 안내", imageAlt: "다른 배너", imageSrc: "/other.svg" },
    { id: "showcase", href: "/events/project-showcase", title: "기존 이벤트", description: "체험 안내", imageAlt: "체험 배너", imageSrc: "/old.svg" },
  ];
  const before = structuredClone(slides);
  const ordered = promotions.promoteShowcaseResultsSlide(slides, true);
  assert.deepEqual(ordered.map((slide) => slide.id), ["showcase", "other"]);
  assert.deepEqual(ordered[0], slides[1]);
  assert.deepEqual(ordered[1], slides[0]);
  assert.deepEqual(slides, before);
  assert.deepEqual(promotions.promoteShowcaseResultsSlide(slides, false), slides);
  assert.deepEqual(promotions.promoteShowcaseResultsSlide([], true), []);
});

test("관리자가 이미지를 다시 교체해도 종료 결과 처리는 모든 편집 값을 보존한다", () => {
  for (const imageSrc of ["https://cdn.example.com/first.webp", "https://cdn.example.com/replacement.webp", "/custom-banner.svg"]) {
    const saved = Object.freeze({
      href: "/events/project-showcase", title: "운영자가 저장한 제목", description: "운영자가 저장한 설명",
      imageAlt: "운영자가 저장한 대체 텍스트", imageSrc,
      audiences: ["guest"], allowedCampuses: ["seoul"], sponsorLabel: "운영자 설정",
    });
    assert.deepEqual(promotions.promoteShowcaseResultsSlide(Object.freeze([saved]), true), [saved]);
  }
});
