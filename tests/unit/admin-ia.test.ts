import { describe, expect, it } from "vitest";
import {
  ADMIN_PARTNER_PAGE_SIZE_OPTIONS,
  ADMIN_REVIEW_QUEUE_PAGE_SIZE_OPTIONS,
  DEFAULT_ADMIN_REVIEW_QUEUE_PAGE_SIZE,
  DEFAULT_ADMIN_PARTNER_PAGE_SIZE,
  ADMIN_MEMBER_PAGE_SIZE_OPTIONS,
  DEFAULT_ADMIN_MEMBER_PAGE_SIZE,
  parseAdminPartnerListFilters,
  parseAdminPartnerPageSize,
  parseAdminReviewQueuePagination,
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

  it("normalizes partner list URL state to safe server-side filters", () => {
    expect(ADMIN_PARTNER_PAGE_SIZE_OPTIONS).toEqual([12, 24, 48]);
    expect(DEFAULT_ADMIN_PARTNER_PAGE_SIZE).toBe(24);
    expect(parseAdminPartnerPageSize("12")).toBe(12);
    expect(parseAdminPartnerPageSize("999")).toBe(24);
    expect(
      parseAdminPartnerListFilters({
        q: "  르블라썸 강남점  ",
        category: "beauty",
        visibility: "confidential",
        sort: "endingSoon",
        page: "4",
        pageSize: "48",
      }),
    ).toEqual({
      searchValue: "르블라썸 강남점",
      categoryKey: "beauty",
      visibility: "confidential",
      sort: "endingSoon",
      page: 4,
      pageSize: 48,
    });
    expect(
      parseAdminPartnerListFilters({
        q: "x".repeat(121),
        category: "<invalid>",
        visibility: "internal",
        sort: "popular",
        page: "0",
        pageSize: "100",
      }),
    ).toEqual({
      searchValue: "x".repeat(80),
      categoryKey: "all",
      visibility: "all",
      sort: "recent",
      page: 1,
      pageSize: 24,
    });
  });

  it("normalizes review queue pagination without accepting unbounded page sizes", () => {
    expect(ADMIN_REVIEW_QUEUE_PAGE_SIZE_OPTIONS).toEqual([6, 12, 24]);
    expect(DEFAULT_ADMIN_REVIEW_QUEUE_PAGE_SIZE).toBe(12);
    expect(parseAdminReviewQueuePagination({ page: "3", pageSize: "24" })).toEqual({
      page: 3,
      pageSize: 24,
    });
    expect(parseAdminReviewQueuePagination({ page: "0", pageSize: "1000" })).toEqual({
      page: 1,
      pageSize: 12,
    });
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
