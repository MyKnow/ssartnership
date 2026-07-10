import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  countScopedAdminRegistrationRows,
  type AdminRegistrationScopeRow,
} from "../src/lib/admin-dashboard-scope.ts";

const rows: AdminRegistrationScopeRow[] = [
  {
    location: "서울특별시 강남구 테헤란로",
    company: { managed_campus_slugs: ["seoul"] },
  },
  {
    location: "대전광역시 유성구",
    company: [{ managed_campus_slugs: ["daejeon"] }],
  },
  {
    location: "서울특별시 강남구 역삼동",
    company: null,
  },
  {
    location: "온라인 전용",
    company: null,
  },
];

describe("admin dashboard regional scope", () => {
  it("counts every pending registration for a global administrator", () => {
    assert.equal(
      countScopedAdminRegistrationRows(
        { permissionId: "operations_manager", managedCampusSlugs: [] },
        rows,
      ),
      4,
    );
  });

  it("counts only company or location rows within a regional administrator scope", () => {
    assert.equal(
      countScopedAdminRegistrationRows(
        {
          permissionId: "regional_partner_manager",
          managedCampusSlugs: ["seoul"],
        },
        rows,
      ),
      2,
    );
  });

  it("denies all regional queue rows when no managed campus is assigned", () => {
    assert.equal(
      countScopedAdminRegistrationRows(
        {
          permissionId: "regional_partner_manager",
          managedCampusSlugs: [],
        },
        rows,
      ),
      0,
    );
  });

  it("filters change-request counts by scoped partner ids in the dashboard query", async () => {
    const source = await readFile(
      new URL("../src/app/admin/(protected)/page.tsx", import.meta.url),
      "utf8",
    );

    assert.match(source, /getManagedCampusFilterValues/);
    assert.match(source, /\.overlaps\("managed_campus_slugs", managedCampusFilter\)/);
    assert.match(source, /\.in\("partner_id", scopedPartnerIds\)/);
    assert.match(source, /partnerCount: scopedPartnerIds\.length/);
  });
});
