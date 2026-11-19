import { describe, expect, it } from "vitest";
import {
  buildPartnerDetailHref,
  parseHomeDirectoryState,
  reconcileRouterSearchValue,
  recordOwnSearchWrite,
  serializeHomeDirectoryState,
} from "@/lib/home-directory-state";

describe("home directory URL state", () => {
  it("parses canonical filters and rejects unsupported values", () => {
    expect(
      parseHomeDirectoryState(
        new URLSearchParams({
          q: "  역삼 카페 ",
          category: "cafe",
          campus: "seoul",
          audience: "student",
          sort: "recent",
          view: "list",
        }),
        ["cafe", "health"],
      ),
    ).toEqual({
      q: "역삼 카페",
      category: "cafe",
      campus: "seoul",
      audience: "student",
      sort: "recent",
      view: "list",
    });

    expect(
      parseHomeDirectoryState(
        new URLSearchParams({
          category: "unknown",
          campus: "unknown",
          audience: "admin",
          sort: "oldest",
          view: "table",
        }),
        ["cafe"],
      ),
    ).toEqual({
      q: "",
      category: "all",
      campus: "all",
      audience: "all",
      sort: "popular",
      view: "card",
    });
    expect(parseHomeDirectoryState(new URLSearchParams())).toEqual({
      q: "",
      category: "all",
      campus: "all",
      audience: "all",
      sort: "popular",
      view: "card",
    });
    expect(
      parseHomeDirectoryState(
        new URLSearchParams({ category: "한글 카테고리", audience: "all" }),
      ).category,
    ).toBe("all");
  });

  it("serializes non-default filters while preserving unrelated keys", () => {
    expect(
      serializeHomeDirectoryState(
        {
          q: "카페",
          category: "all",
          campus: "gumi",
          audience: "staff",
          sort: "endingSoon",
          view: "list",
        },
        new URLSearchParams({ campaign: "summer", category: "old" }),
      ).toString(),
    ).toBe(
      "campaign=summer&q=%EC%B9%B4%ED%8E%98&campus=gumi&audience=staff&sort=endingSoon&view=list",
    );

    expect(
      serializeHomeDirectoryState({
        q: "",
        category: "all",
        campus: "all",
        audience: "all",
        sort: "popular",
        view: "card",
      }).toString(),
    ).toBe("");
  });

  it("builds a detail href with an optional filter-aware return path", () => {
    expect(buildPartnerDetailHref("partner/one")).toBe(
      "/partners/partner%2Fone",
    );
    expect(buildPartnerDetailHref("partner/one", "/?category=cafe#benefits")).toBe(
      "/partners/partner%2Fone?returnTo=%2F%3Fcategory%3Dcafe%23benefits",
    );
  });
});

describe("home directory search echo reconciliation", () => {
  it("ignores a delayed router echo of the directory's own write", () => {
    const pending = recordOwnSearchWrite([], "__no_such_partner__");
    // The user clears the input before Next.js reflects the write.
    expect(reconcileRouterSearchValue(pending, "__no_such_partner__")).toEqual({
      pending: [],
      external: false,
    });
  });

  it("consumes skipped intermediate echoes in write order", () => {
    const pending = recordOwnSearchWrite(recordOwnSearchWrite([], "cafe"), "");
    expect(reconcileRouterSearchValue(pending, "cafe")).toEqual({ pending: [""], external: false });
    expect(reconcileRouterSearchValue(pending, "")).toEqual({ pending: [], external: false });
  });

  it("treats an unknown router value as external navigation", () => {
    expect(reconcileRouterSearchValue(["cafe"], "gym")).toEqual({ pending: [], external: true });
    expect(reconcileRouterSearchValue([], "")).toEqual({ pending: [], external: true });
  });

  it("bounds the pending write history", () => {
    let pending: string[] = [];
    for (let index = 0; index < 30; index += 1) pending = recordOwnSearchWrite(pending, String(index));
    expect(pending).toHaveLength(20);
    expect(pending[0]).toBe("10");
  });
});
