import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("공개·회원 및 관리자 셸은 맨 위로 이동 FAB를 렌더링하지 않는다", async () => {
  const [siteLayout, adminShell] = await Promise.all([
    readFile(new URL("../src/app/(site)/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminShellView.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(siteLayout, /ScrollToTopFab|FloatingActionGroup/);
  assert.doesNotMatch(adminShell, /ScrollToTopFab|FloatingActionGroup/);

  await Promise.all([
    assert.rejects(access(new URL("../src/components/ScrollToTopFab.tsx", import.meta.url))),
    assert.rejects(
      access(new URL("../src/components/ScrollToTopFab.stories.tsx", import.meta.url)),
    ),
    assert.rejects(access(new URL("../src/components/FloatingActionGroup.tsx", import.meta.url))),
  ]);
});
