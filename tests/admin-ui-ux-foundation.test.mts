import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ADMIN_NAV_GROUPS,
  filterAdminNavGroupsByPermissions,
} from "../src/components/admin/admin-navigation.ts";
import { ADMIN_PERMISSION_TEMPLATES } from "../src/lib/admin-permissions.ts";

test("관리 메뉴는 운영 목적에 맞는 다섯 그룹과 기존 권한 필터를 유지한다", () => {
  assert.deepEqual(
    ADMIN_NAV_GROUPS.map((group) => group.label),
    ["개요", "회원·검토", "제휴 운영", "메시지·노출", "운영 기록·설정"],
  );

  const operationsGroup = ADMIN_NAV_GROUPS.find(
    (group) => group.label === "운영 기록·설정",
  );
  assert.ok(operationsGroup?.items.some((item) => item.href === "/admin/logs"));

  const regionalPermissions = ADMIN_PERMISSION_TEMPLATES.find(
    (template) => template.key === "regional_partner_manager",
  )?.permissions;
  assert.ok(regionalPermissions);
  const regionalGroups = filterAdminNavGroupsByPermissions(
    ADMIN_NAV_GROUPS,
    regionalPermissions,
    { includeGlobalItems: false },
  );
  assert.equal(
    regionalGroups.flatMap((group) => group.items).some(
      (item) => item.href === "/admin/categories",
    ),
    false,
  );
});

test("회원 화면은 내부 오류를 노출하지 않고 목록 이후에 보조 운영 도구를 둔다", async () => {
  const source = await readFile(
    new URL("../src/app/admin/(protected)/members/page.tsx", import.meta.url),
    "utf8",
  );
  const memberListIndex = source.indexOf('title="회원 목록"');
  const operationsToolIndex = source.indexOf('title="운영 도구"');

  assert.ok(memberListIndex >= 0);
  assert.ok(operationsToolIndex > memberListIndex);
  assert.doesNotMatch(source, /membersError\.message/);
});

test("관리 셸은 문서 제목을 만들지 않고 페이지 헤더가 단일 h1을 맡는다", async () => {
  const [shellSource, pageHeaderSource] = await Promise.all([
    readFile(
      new URL("../src/components/admin/AdminShellView.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/admin/AdminPageHeader.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.doesNotMatch(shellSource, /<h1[\s>]/);
  assert.match(pageHeaderSource, /<h1 className=/);
});
