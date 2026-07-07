import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAdminAccessManagedCampuses,
  isRegionalAdminPermission,
  normalizeAdminManagedCampusSlugs,
  resolveCreatedManagedCampusSlugs,
} from "../src/lib/admin-scope.ts";
import { findAdminPermissionTemplate } from "../src/lib/admin-permissions.ts";

function createAccount(permissionId: string, managedCampusSlugs: string[]) {
  return {
    permissionId,
    managedCampusSlugs,
  };
}

describe("regional admin scope", () => {
  it("adds a regional partner manager template without member/admin access", () => {
    const template = findAdminPermissionTemplate("regional_partner_manager");

    assert.ok(template);
    assert.equal(template.permissions.brands.read, true);
    assert.equal(template.permissions.brands.create, true);
    assert.equal(template.permissions.brands.update, true);
    assert.equal(template.permissions.brands.delete, false);
    assert.equal(template.permissions.companies.read, true);
    assert.equal(template.permissions.companies.create, true);
    assert.equal(template.permissions.companies.update, true);
    assert.equal(template.permissions.companies.delete, false);
    assert.equal(template.permissions.logs.create, false);
    assert.equal(template.permissions.logs.read, false);
    assert.equal(template.permissions.logs.update, false);
    assert.equal(template.permissions.logs.delete, false);
    assert.equal(template.permissions.members.read, false);
    assert.equal(template.permissions.admin_management.read, false);
  });

  it("normalizes managed campuses to known unique campus slugs", () => {
    assert.deepEqual(
      normalizeAdminManagedCampusSlugs(["seoul", "seoul", "invalid", "daejeon"]),
      ["seoul", "daejeon"],
    );
  });

  it("checks regional admin access by managed campus, not visible campus", () => {
    const regionalAccount = createAccount("regional_partner_manager", ["seoul"]);
    const operationsAccount = createAccount("operations_manager", []);

    assert.equal(isRegionalAdminPermission(regionalAccount.permissionId), true);
    assert.equal(canAdminAccessManagedCampuses(regionalAccount, ["seoul"]), true);
    assert.equal(canAdminAccessManagedCampuses(regionalAccount, ["daejeon"]), false);
    assert.equal(
      canAdminAccessManagedCampuses(regionalAccount, ["seoul", "daejeon"]),
      true,
    );
    assert.equal(canAdminAccessManagedCampuses(operationsAccount, ["daejeon"]), true);
  });

  it("forces created records to the regional admin managed campuses", () => {
    const regionalAccount = createAccount("regional_partner_manager", ["seoul"]);
    const operationsAccount = createAccount("operations_manager", []);

    assert.deepEqual(
      resolveCreatedManagedCampusSlugs(regionalAccount, ["daejeon", "gumi"]),
      ["seoul"],
    );
    assert.deepEqual(
      resolveCreatedManagedCampusSlugs(operationsAccount, ["daejeon", "gumi"]),
      ["daejeon", "gumi"],
    );
  });
});
