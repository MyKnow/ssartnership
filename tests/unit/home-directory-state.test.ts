import { describe, expect, it } from "vitest";
import {
  buildPartnerDetailHref,
  parseHomeDirectoryState,
  serializeHomeDirectoryState,
} from "@/lib/home-directory-state";

describe("home directory URL state", () => {
  it("parses canonical filters and rejects unsupported values", () => {
    expect(
      parseHomeDirectoryState(
        new URLSearchParams({
          q: "  역삼 카페 ",
          category: "cafe",
          audience: "student",
          sort: "recent",
        }),
        ["cafe", "health"],
      ),
    ).toEqual({
      q: "역삼 카페",
      category: "cafe",
      audience: "student",
      sort: "recent",
    });

    expect(
      parseHomeDirectoryState(
        new URLSearchParams({
          category: "unknown",
          audience: "admin",
          sort: "oldest",
        }),
        ["cafe"],
      ),
    ).toEqual({ q: "", category: "all", audience: "all", sort: "popular" });
    expect(parseHomeDirectoryState(new URLSearchParams())).toEqual({
      q: "",
      category: "all",
      audience: "all",
      sort: "popular",
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
          audience: "staff",
          sort: "endingSoon",
        },
        new URLSearchParams({ campaign: "summer", category: "old" }),
      ).toString(),
    ).toBe(
      "campaign=summer&q=%EC%B9%B4%ED%8E%98&audience=staff&sort=endingSoon",
    );

    expect(
      serializeHomeDirectoryState({
        q: "",
        category: "all",
        audience: "all",
        sort: "popular",
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
