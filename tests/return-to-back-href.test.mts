import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { resolveBackHref, sanitizeReturnTo } from "../src/lib/return-to.ts";

const ORIGIN = "https://ssartnership.example";

function readSource(path: string) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("뒤로 가기 returnTo는 외부 origin·프로토콜 상대·스크립트 경로를 fallback으로 대체한다", () => {
  const unsafeReturnTo = [
    "//evil.com",
    "https://evil.com/phish",
    "javascript:alert(1)",
    "/\\evil.com",
    "/\t/evil.com",
    "%2F%2Fevil.com",
    "data:text/html,hi",
  ];

  for (const value of unsafeReturnTo) {
    const search = `?${new URLSearchParams({ returnTo: value }).toString()}`;
    assert.equal(
      resolveBackHref({ search, fallbackHref: "/partners" }),
      "/partners",
      value,
    );
  }
});

test("뒤로 가기 returnTo는 같은 사이트 경로와 query·hash를 보존한다", () => {
  assert.equal(
    resolveBackHref({
      search: `?returnTo=${encodeURIComponent("/partners?page=2#list")}`,
    }),
    "/partners?page=2#list",
  );
});

test("뒤로 가기는 returnTo가 없으면 같은 origin referrer 경로만 사용한다", () => {
  assert.equal(
    resolveBackHref({
      referrer: `${ORIGIN}/campuses/seoul?tab=food`,
      currentOrigin: ORIGIN,
    }),
    "/campuses/seoul?tab=food",
  );
  assert.equal(
    resolveBackHref({
      referrer: "https://evil.com/campuses",
      currentOrigin: ORIGIN,
      fallbackHref: "/legal/privacy",
    }),
    "/legal/privacy",
  );
  assert.equal(
    resolveBackHref({
      referrer: `${ORIGIN}//evil.com/path`,
      currentOrigin: ORIGIN,
    }),
    "/",
  );
  assert.equal(
    resolveBackHref({ referrer: "not a url", currentOrigin: ORIGIN }),
    "/",
  );
});

test("뒤로 가기 fallback도 같은 sanitizer를 통과한다", () => {
  assert.equal(resolveBackHref({ fallbackHref: "//evil.com" }), "/");
  assert.equal(sanitizeReturnTo("//evil.com", ""), "");
});

test("BackButton과 정책 버전 선택은 공용 returnTo sanitizer를 사용한다", async () => {
  const [backButton, versionSelect] = await Promise.all([
    readSource("../src/components/ui/BackButton.tsx"),
    readSource("../src/components/legal/PolicyDocumentVersionSelect.tsx"),
  ]);

  assert.match(backButton, /import \{ resolveBackHref \} from "@\/lib\/return-to";/);
  assert.doesNotMatch(backButton, /startsWith\("\/"\)/);
  assert.match(versionSelect, /import \{ sanitizeReturnTo \} from "@\/lib\/return-to";/);
  assert.match(versionSelect, /sanitizeReturnTo\(searchParams\.get\("returnTo"\), ""\)/);
});
