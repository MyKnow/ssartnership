import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

test("관리자 회원 상세 조회는 회원이 확인된 뒤 감사 기록을 남긴다", async () => {
  const [page, catalog] = await Promise.all([
    readFile(new URL("src/app/admin/(protected)/members/[memberId]/page.tsx", root), "utf8"),
    readFile(new URL("src/lib/event-catalog.ts", root), "utf8"),
  ]);
  assert.match(catalog, /'member_detail_view',/u);

  const notFoundIndex = page.indexOf("notFound();\n  }");
  const auditIndex = page.indexOf('action: "member_detail_view"');
  const renderIndex = page.indexOf("const member = detail.member;");
  assert.ok(notFoundIndex > 0 && auditIndex > notFoundIndex, "missing members are not recorded as views");
  assert.ok(renderIndex > auditIndex, "the access is recorded before member data renders");
  assert.match(
    page,
    /await logAdminAudit\(\{\s+\.\.\.\(await getServerActionLogContext\(\)\),\s+action: "member_detail_view",\s+actorId: adminSession\.adminId,\s+targetType: "member",\s+targetId: memberId,/u,
  );
});
