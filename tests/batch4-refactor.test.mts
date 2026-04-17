import assert from "node:assert/strict";
import test from "node:test";

type MediaEditorModule = typeof import("../src/components/admin/partner-media-editor/utils.ts");
type PartnerCardFormModule = typeof import("../src/components/partner-card-form/usePartnerCardFormState.ts");
type PartnerManagerSelectorModule = typeof import("../src/components/admin/partner-manager/selectors.ts");

const mediaEditorModulePromise = import(
  new URL("../src/components/admin/partner-media-editor/utils.ts", import.meta.url).href
) as Promise<MediaEditorModule>;
const partnerCardFormModulePromise = import(
  new URL("../src/components/partner-card-form/usePartnerCardFormState.ts", import.meta.url).href
) as Promise<PartnerCardFormModule>;
const partnerManagerSelectorModulePromise = import(
  new URL("../src/components/admin/partner-manager/selectors.ts", import.meta.url).href
) as Promise<PartnerManagerSelectorModule>;

test("media helpers reorder, remove, and build manifest deterministically", async () => {
  const {
    reorderMediaItems,
    removeMediaItemAt,
    manifestForItems,
    manifestEntryForItem,
  } = await mediaEditorModulePromise;

  const items = [
    { id: "one", kind: "existing" as const, url: "https://example.com/1.webp" },
    { id: "two", kind: "existing" as const, url: "https://example.com/2.webp" },
    { id: "three", kind: "file" as const, url: "blob:test" },
  ];

  const moved = reorderMediaItems(items, 2, -1);
  assert.deepStrictEqual(moved.map((item) => item.id), ["one", "three", "two"]);

  const removed = removeMediaItemAt(moved, 1);
  assert.deepStrictEqual(removed.map((item) => item.id), ["one", "two"]);

  assert.deepStrictEqual(manifestEntryForItem(items[0]), {
    kind: "existing",
    url: "https://example.com/1.webp",
  });
  assert.deepStrictEqual(manifestForItems(items), [
    { kind: "existing", url: "https://example.com/1.webp" },
    { kind: "existing", url: "https://example.com/2.webp" },
    { kind: "upload" },
  ]);
});

test("partner card form helpers derive defaults and company lock state", async () => {
  const {
    createPartnerCardFormState,
    getCompanyFieldsLocked,
    getPartnerCardInvalidClass,
  } = await partnerCardFormModulePromise;

  const state = createPartnerCardFormState(
    {
      name: "레코디드",
      visibility: "confidential",
      location: "역삼",
      mapUrl: "https://example.com/map",
      reservationLink: "https://example.com/reserve",
      inquiryLink: "https://example.com/inquiry",
      period: { start: "2026-04-01", end: "2026-04-30" },
      appliesTo: ["student"],
      company: {
        id: "company-1",
        name: "오디터스",
      },
    },
    "category-1",
  );

  assert.equal(state.nameValue, "레코디드");
  assert.equal(state.categoryValue, "category-1");
  assert.equal(state.selectedCompanyId, "company-1");
  assert.deepStrictEqual(state.appliesToValue, ["student"]);
  assert.equal(getCompanyFieldsLocked("company-1"), true);
  assert.equal(getCompanyFieldsLocked(""), false);
  assert.equal(getPartnerCardInvalidClass(true), "border-danger/40 ring-2 ring-danger/15");
  assert.equal(getPartnerCardInvalidClass(false), undefined);
});

test("admin partner selectors preserve search, filters, and active-first sorting", async () => {
  const {
    createAdminPartnerCategoryOptions,
    createAdminPartnerCompanyOptions,
    buildCategoryKeyById,
    filterAndSortAdminPartners,
  } = await partnerManagerSelectorModulePromise;

  const categories = [
    { id: "cat-1", key: "food", label: "식당", description: "식당" },
    { id: "cat-2", key: "fitness", label: "운동", description: "운동" },
  ];
  const companies = [
    { id: "co-1", name: "오디터스", slug: "auditors" },
  ];
  const partners = [
    {
      id: "partner-active",
      name: "레코디드",
      category_id: "cat-1",
      visibility: "public" as const,
      location: "역삼",
      period_start: "2026-01-01",
      period_end: "2099-12-31",
      benefits: ["할인"],
      conditions: ["학생증"],
      applies_to: ["student"],
      tags: ["삼겹살"],
      company: { id: "co-1", name: "오디터스", slug: "auditors" },
    },
    {
      id: "partner-inactive",
      name: "어반짐",
      category_id: "cat-2",
      visibility: "private" as const,
      location: "선릉",
      period_start: "2025-01-01",
      period_end: "2025-01-31",
      benefits: [],
      conditions: [],
      applies_to: ["graduate"],
      tags: ["헬스"],
      company: null,
    },
  ];

  assert.equal(createAdminPartnerCategoryOptions(categories).length, 2);
  assert.equal(createAdminPartnerCompanyOptions(companies)[0]?.slug, "auditors");

  const filtered = filterAndSortAdminPartners({
    partners,
    categoryKeyById: buildCategoryKeyById(categories),
    activeCategory: "all",
    visibilityFilter: "all",
    searchValue: "레코디드 오디터스",
    sortValue: "recent",
  });
  assert.deepStrictEqual(filtered.map((partner) => partner.id), ["partner-active"]);

  const activeFirst = filterAndSortAdminPartners({
    partners,
    categoryKeyById: buildCategoryKeyById(categories),
    activeCategory: "all",
    visibilityFilter: "all",
    searchValue: "",
    sortValue: "endingSoon",
  });
  assert.deepStrictEqual(activeFirst.map((partner) => partner.id), [
    "partner-active",
    "partner-inactive",
  ]);
});
