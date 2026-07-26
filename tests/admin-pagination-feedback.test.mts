import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const managerPaths = [
  new URL("../src/components/admin/AdminMemberManager.tsx", import.meta.url),
  new URL("../src/components/admin/AdminPartnerManager.tsx", import.meta.url),
];

test("관리자 목록 페이지 이동은 transition 전에 요청 페이지를 표시한다", async () => {
  const sources = await Promise.all(
    managerPaths.map((path) => readFile(path, "utf8")),
  );

  for (const source of sources) {
    const updateQuerySource = source.slice(source.indexOf("const updateQuery"));
    const requestedPageIndex = updateQuerySource.indexOf(
      "setRequestedPage(pendingPage)",
    );
    const transitionIndex = updateQuerySource.indexOf("startTransition(() =>");

    assert.notEqual(requestedPageIndex, -1);
    assert.notEqual(transitionIndex, -1);
    assert.ok(
      requestedPageIndex < transitionIndex,
      "pending page feedback must commit before the route transition",
    );
  }
});
