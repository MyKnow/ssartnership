import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("회원 XLSX 업로드는 생성 전에 인증된 행 전개 API로만 파싱한다", async () => {
  const [route, panel] = await Promise.all([
    read("src/app/api/admin/member-imports/rows/route.ts"),
    read("src/components/admin/AdminMemberManualAddPanel.tsx"),
  ]);

  assert.match(route, /isTrustedSameOriginRequest/);
  assert.match(route, /canAdmin\(session\.account\.permissions, "members", "create"\)/);
  assert.match(route, /parseManualMemberImportWorkbook/);
  assert.match(panel, /\/api\/admin\/member-imports\/rows/);
  assert.match(panel, /appendManualMemberImportWorkbookRows/);
});
