import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminLogAccessPolicy,
  selectAllowedLogGroups,
} from "@/lib/admin-log-access";
import { findAdminPermissionTemplate } from "@/lib/admin-permissions";

test("로그 접근 정책은 템플릿별 그룹·내보내기·원문 PII 권한을 분리한다", () => {
  const superAdmin = findAdminPermissionTemplate("super_admin");
  const contentManager = findAdminPermissionTemplate("content_manager");
  const support = findAdminPermissionTemplate("support");
  assert.ok(superAdmin);
  assert.ok(contentManager);
  assert.ok(support);

  assert.deepEqual(
    getAdminLogAccessPolicy({
      permissionId: superAdmin.key,
      permissions: superAdmin.permissions,
    }),
    {
      readGroups: ["product", "audit", "security"],
      exportGroups: ["product", "audit", "security"],
      includePii: true,
    },
  );

  assert.deepEqual(
    getAdminLogAccessPolicy({
      permissionId: contentManager.key,
      permissions: contentManager.permissions,
    }),
    {
      readGroups: ["product", "audit"],
      exportGroups: [],
      includePii: false,
    },
  );

  assert.deepEqual(
    getAdminLogAccessPolicy({
      permissionId: support.key,
      permissions: support.permissions,
    }),
    {
      readGroups: ["audit", "security"],
      exportGroups: [],
      includePii: false,
    },
  );
});

test("알 수 없거나 로그 조회 권한이 없는 정책은 모든 로그 접근을 거부한다", () => {
  const empty = getAdminLogAccessPolicy({
    permissionId: "unknown" as never,
    permissions: null,
  });

  assert.deepEqual(empty, {
    readGroups: [],
    exportGroups: [],
    includePii: false,
  });
  assert.deepEqual(selectAllowedLogGroups(["product", "security"], empty.exportGroups), []);
});

test("내보내기 그룹은 정책이 허용한 부분집합만 선택한다", () => {
  assert.deepEqual(
    selectAllowedLogGroups(["audit", "product", "audit"], ["product", "audit"]),
    ["audit", "product"],
  );
  assert.deepEqual(
    selectAllowedLogGroups(["security"], ["product", "audit"]),
    [],
  );
});
