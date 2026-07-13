import { describe, expect, it } from "vitest";
import {
  ADMIN_MEMBER_PAGE_SIZE_OPTIONS,
  DEFAULT_ADMIN_MEMBER_PAGE_SIZE,
  parseAdminMemberPageSize,
  resolveAdminPartnerTabRedirect,
} from "@/lib/admin-ia";

describe("admin IA helpers", () => {
  it("parses only supported member page sizes", () => {
    expect(ADMIN_MEMBER_PAGE_SIZE_OPTIONS).toEqual([10, 20, 50, 100]);
    expect(DEFAULT_ADMIN_MEMBER_PAGE_SIZE).toBe(20);
    expect(parseAdminMemberPageSize("10")).toBe(10);
    expect(parseAdminMemberPageSize("100")).toBe(100);
    expect(parseAdminMemberPageSize("not-a-number")).toBe(20);
    expect(parseAdminMemberPageSize(undefined)).toBe(20);
  });

  it("maps only legacy partner workspace tabs", () => {
    expect(resolveAdminPartnerTabRedirect("requests")).toBe(
      "/admin/partner-requests",
    );
    expect(resolveAdminPartnerTabRedirect("categories")).toBe(
      "/admin/categories",
    );
    expect(resolveAdminPartnerTabRedirect("category")).toBe(
      "/admin/categories",
    );
    expect(resolveAdminPartnerTabRedirect("partners")).toBeNull();
    expect(resolveAdminPartnerTabRedirect(undefined)).toBeNull();
  });
});
