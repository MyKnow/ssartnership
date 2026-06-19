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
