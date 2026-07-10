import { describe, expect, it } from "vitest";
import { countScopedAdminRegistrationRows } from "@/lib/admin-dashboard-scope";

const rows = [
  {
    location: "서울특별시 강남구 테헤란로",
    company: { managed_campus_slugs: ["seoul"] },
  },
  {
    location: "대전광역시 유성구",
    company: [{ managed_campus_slugs: ["daejeon"] }],
  },
  { location: "서울특별시 강남구 역삼동", company: null },
  { location: null, company: null },
] as const;

describe("admin dashboard registration scope", () => {
  it("keeps every row for a global administrator", () => {
    expect(
      countScopedAdminRegistrationRows(
        { permissionId: "operations_manager", managedCampusSlugs: [] },
        rows,
      ),
    ).toBe(4);
  });

  it("counts only rows visible in a regional campus scope", () => {
    expect(
      countScopedAdminRegistrationRows(
        {
          permissionId: "regional_partner_manager",
          managedCampusSlugs: ["seoul"],
        },
        rows,
      ),
    ).toBe(2);
    expect(
      countScopedAdminRegistrationRows(
        {
          permissionId: "regional_partner_manager",
          managedCampusSlugs: [],
        },
        rows,
      ),
    ).toBe(0);
  });
});
