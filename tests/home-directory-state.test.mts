import assert from "node:assert/strict";
import test from "node:test";

type HomeDirectoryStateModule = typeof import(
  "../src/lib/home-directory-state.ts"
);

const modulePromise = import(
  new URL("../src/lib/home-directory-state.ts", import.meta.url).href
) as Promise<HomeDirectoryStateModule>;

test("parseHomeDirectoryState accepts the canonical URL filter keys", async () => {
  const { parseHomeDirectoryState } = await modulePromise;

  assert.deepEqual(
    parseHomeDirectoryState(
      new URLSearchParams({
        q: "  역삼 헬스  ",
        category: "health",
        audience: "student",
        sort: "endingSoon",
      }),
    ),
    {
      q: "역삼 헬스",
      category: "health",
      audience: "student",
      sort: "endingSoon",
    },
  );
});

test("parseHomeDirectoryState falls back safely for unsupported values", async () => {
  const { parseHomeDirectoryState } = await modulePromise;

  assert.deepEqual(
    parseHomeDirectoryState(
      new URLSearchParams({
        category: "not-a-category",
        audience: "admin",
        sort: "oldest",
      }),
      ["cafe", "health"],
    ),
    {
      q: "",
      category: "all",
      audience: "all",
      sort: "popular",
    },
  );

  assert.deepEqual(parseHomeDirectoryState(new URLSearchParams()), {
    q: "",
    category: "all",
    audience: "all",
    sort: "popular",
  });
  assert.equal(
    parseHomeDirectoryState(new URLSearchParams({ category: "한글 카테고리" }))
      .category,
    "all",
  );
});

test("serializeHomeDirectoryState omits defaults and preserves unrelated URL keys", async () => {
  const { serializeHomeDirectoryState } = await modulePromise;

  const result = serializeHomeDirectoryState(
    {
      q: "카페",
      category: "all",
      audience: "staff",
      sort: "popular",
    },
    new URLSearchParams({ campaign: "summer" }),
  );

  assert.equal(result.toString(), "campaign=summer&q=%EC%B9%B4%ED%8E%98&audience=staff");
});

test("buildPartnerDetailHref stores the full directory URL for filter-aware return", async () => {
  const { buildPartnerDetailHref } = await modulePromise;

  assert.equal(
    buildPartnerDetailHref(
      "partner/one",
      "/?q=%EC%B9%B4%ED%8E%98&category=cafe#benefits",
    ),
    "/partners/partner%2Fone?returnTo=%2F%3Fq%3D%25EC%25B9%25B4%25ED%258E%2598%26category%3Dcafe%23benefits",
  );
  assert.equal(buildPartnerDetailHref("plain-id"), "/partners/plain-id");
});
