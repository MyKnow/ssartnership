import assert from "node:assert/strict";
import test from "node:test";

const adminPermissionsModulePromise = import(
  new URL("../src/lib/admin-permissions.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/admin-permissions.ts")>;

test("admin permission matrix defaults every resource action to false", async () => {
  const { createEmptyAdminPermissionMatrix, ADMIN_PERMISSION_RESOURCES, ADMIN_PERMISSION_ACTIONS } =
    await adminPermissionsModulePromise;

  const matrix = createEmptyAdminPermissionMatrix();

  for (const resource of ADMIN_PERMISSION_RESOURCES) {
    for (const action of ADMIN_PERMISSION_ACTIONS) {
      assert.equal(matrix[resource][action], false);
    }
  }
});

test("super admin template grants all supported permissions except log writes", async () => {
  const { ADMIN_PERMISSION_ACTIONS, ADMIN_PERMISSION_TEMPLATES, canAdmin } =
    await adminPermissionsModulePromise;

  const template = ADMIN_PERMISSION_TEMPLATES.find(
    (candidate) => candidate.key === "super_admin",
  );

  assert.ok(template);
  assert.equal(canAdmin(template.permissions, "logs", "read"), true);
  for (const action of ADMIN_PERMISSION_ACTIONS.filter((item) => item !== "read")) {
    assert.equal(canAdmin(template.permissions, "logs", action), false);
  }
  assert.equal(canAdmin(template.permissions, "admin_management", "delete"), true);
});

test("normalizing permission matrix enforces logs read-only", async () => {
  const { normalizeAdminPermissionMatrix, canAdmin } =
    await adminPermissionsModulePromise;

  const normalized = normalizeAdminPermissionMatrix({
    logs: {
      create: true,
      read: true,
      update: true,
      delete: true,
    },
  });

  assert.equal(canAdmin(normalized, "logs", "read"), true);
  assert.equal(canAdmin(normalized, "logs", "create"), false);
  assert.equal(canAdmin(normalized, "logs", "update"), false);
  assert.equal(canAdmin(normalized, "logs", "delete"), false);
});

test("self protection rejects disabling the last privileged admin", async () => {
  const {
    ADMIN_PERMISSION_TEMPLATES,
    assertCanManageAdminPermissions,
    createEmptyAdminPermissionMatrix,
  } = await adminPermissionsModulePromise;

  const superAdmin = ADMIN_PERMISSION_TEMPLATES.find(
    (candidate) => candidate.key === "super_admin",
  );
  assert.ok(superAdmin);

  assert.throws(
    () =>
      assertCanManageAdminPermissions({
        actorAdminId: "admin-1",
        targetAdminId: "admin-1",
        nextIsActive: false,
        nextPermissions: superAdmin.permissions,
        activePrivilegedAdminCount: 1,
      }),
    /마지막 최고 권한 관리자/,
  );

  assert.throws(
    () =>
      assertCanManageAdminPermissions({
        actorAdminId: "admin-1",
        targetAdminId: "admin-1",
        nextIsActive: true,
        nextPermissions: createEmptyAdminPermissionMatrix(),
        activePrivilegedAdminCount: 2,
      }),
    /자기 자신의 관리자 권한/,
  );
});

test("권한 매트릭스의 지원 비트는 서버 가드가 실제로 검사하는 비트와 일치한다", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const path = await import("node:path");
  const {
    ADMIN_PERMISSION_RESOURCES,
    ADMIN_PERMISSION_ACTIONS,
    ADMIN_PERMISSION_SUPPORTED_ACTIONS,
    ADMIN_PERMISSION_TEMPLATES,
    canAdmin,
  } = await adminPermissionsModulePromise;
  const srcRoot = new URL("../src/", import.meta.url).pathname;
  const files = (function list(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return list(absolute);
      return /\.tsx?$/.test(entry.name) && !/\.stories\.tsx$/.test(entry.name)
        ? [absolute]
        : [];
    });
  })(srcRoot).filter((file) => !file.endsWith(path.join("lib", "admin-permissions.ts")));

  const resources = ADMIN_PERMISSION_RESOURCES.join("|");
  const actions = ADMIN_PERMISSION_ACTIONS.join("|");
  const checked = new Set<string>();
  const wrappers: Array<[RegExp, string]> = [
    [new RegExp(`requireMattermostSenderAdmin\\(\\s*"(${actions})"`, "g"), "mattermost_senders"],
    [new RegExp(`canManageMattermostSenders\\(\\s*[\\w.]+,\\s*"(${actions})"`, "g"), "mattermost_senders"],
    [new RegExp(`requireMemberSignupRequestAdmin\\(\\s*"(${actions})"`, "g"), "member_signup_requests"],
    [new RegExp(`requireNotificationTemplateAdmin\\(\\s*"(${actions})"`, "g"), "notification_templates"],
    [new RegExp(`getNotificationTemplateAdminApiSession\\(\\s*\\w+,\\s*"(${actions})"`, "g"), "notification_templates"],
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(new RegExp(`"(${resources})",\\s*"(${actions})"`, "g"))) {
      checked.add(`${match[1]}:${match[2]}`);
    }
    for (const [pattern, resource] of wrappers) {
      for (const match of source.matchAll(pattern)) checked.add(`${resource}:${match[1]}`);
    }
    if (file.endsWith(path.join("admin", "admin-navigation.ts"))) {
      for (const match of source.matchAll(new RegExp(`resource:\\s*"(${resources})"`, "g"))) {
        checked.add(`${match[1]}:read`);
      }
    }
  }
  // The partner benefit usage action forwards a typed "create" | "update" |
  // "delete" union for brands; brands is fully supported either way.

  const supported = new Set(
    ADMIN_PERMISSION_RESOURCES.flatMap((resource) =>
      ADMIN_PERMISSION_SUPPORTED_ACTIONS[resource].map((action) => `${resource}:${action}`),
    ),
  );
  assert.deepEqual([...checked].filter((bit) => !supported.has(bit)).sort(), [], "guarded but unsupported");
  assert.deepEqual([...supported].filter((bit) => !checked.has(bit)).sort(), [], "supported but never guarded");

  for (const template of ADMIN_PERMISSION_TEMPLATES) {
    for (const resource of ADMIN_PERMISSION_RESOURCES) {
      for (const action of ADMIN_PERMISSION_ACTIONS) {
        if (!supported.has(`${resource}:${action}`)) {
          assert.equal(canAdmin(template.permissions, resource, action), false, `${template.key} ${resource}:${action}`);
        }
      }
    }
  }
});
