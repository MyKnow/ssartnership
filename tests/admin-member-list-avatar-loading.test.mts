import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("회원 목록 프로필 사진은 화면 근처 항목만 지연 요청한다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/AdminMemberListItem.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /IntersectionObserver/);
  assert.match(source, /rootMargin: "96px"/);
  assert.match(source, /avatarInView && !avatarFailed/);
  assert.match(source, /loading="lazy"/);
  assert.match(source, /fetchPriority="low"/);
  assert.match(source, /const detailHref = useMemo/);
  assert.match(source, /encodeURIComponent\(member\.id\)/);
  assert.match(source, /new URLSearchParams\(\{ returnTo: normalizedReturnTo \}\)/);
  assert.match(source, /href=\{detailHref\}/);
  assert.match(source, /prefetch=\{false\}/);
});

test("회원 목록 상세 이동은 현재 검색·필터 맥락을 returnTo로 보존한다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/AdminMemberManager.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const returnTo = useMemo/);
  assert.match(source, /\?\$\{searchParamsValue\}/);
  assert.match(source, /returnTo=\{returnTo\}/);
});

test("회원 아바타 API는 조회·Storage 지연을 계측하고 내부 오류를 안전한 응답으로 바꾼다", async () => {
  const source = await readFile(
    new URL("../src/app/api/admin/members/[id]/avatar/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /withServerTiming/);
  assert.match(source, /timing\.measure\("auth"/);
  assert.match(source, /timing\.measure\("query"/);
  assert.match(source, /timing\.measure\("storage"/);
  assert.match(source, /status: 503/);
  assert.doesNotMatch(source, /error\.message/);
});
