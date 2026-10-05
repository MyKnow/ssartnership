import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canViewPartnerDetailRow,
  extractCategoryKey,
  getPartnerBenefitItems,
  mapCategoryRow,
  mapPartnerForDetail,
  mapPartnerForList,
  mapPartnerForPublicDirectory,
  mapPartnerRaw,
  mapPublicPartnerSeoEntry,
  resolvePartnerCategoryKey,
  toLockedPartner,
  toVisiblePartner,
  toVisiblePublicDirectorySummaryPartner,
} from "../src/lib/repositories/supabase/partner/mappers.ts";
import type { PartnerRow } from "../src/lib/repositories/supabase/partner/rows.ts";
import {
  BENEFIT_ELIGIBLE_ONLY_MESSAGE,
  BENEFIT_LOGIN_REQUIRED_MESSAGE,
} from "../src/lib/partner-benefit-visibility.ts";

function createRow(overrides: Partial<PartnerRow> = {}): PartnerRow {
  return {
    id: "partner-1",
    name: "역삼 식당",
    category_id: "category-1",
    created_at: "2026-09-01T00:00:00.000Z",
    location: "서울 강남구 역삼동",
    detail_description: "상세 설명",
    campus_slugs: ["seoul", "unknown"],
    thumbnail: null,
    map_url: "https://map.example.com/partner-1",
    benefit_action_type: null,
    benefit_action_link: null,
    reservation_link: "https://booking.example.com/partner-1",
    inquiry_link: null,
    period_start: null,
    period_end: null,
    conditions: ["학생증 제시"],
    benefits: ["10% 할인", "음료 제공"],
    partner_benefits: null,
    applies_to: ["student"],
    images: ["https://img.example.com/1.png", "https://img.example.com/2.png"],
    tags: ["점심"],
    visibility: "public",
    benefit_visibility: "public",
    branch_scope_type: null,
    branch_scope_note: null,
    categories: [{ key: "food" }],
    ...overrides,
  };
}

describe("partner repository mappers", () => {
  it("resolves the category key from object, array, or missing relations", () => {
    assert.equal(extractCategoryKey({ key: "cafe" }), "cafe");
    assert.equal(extractCategoryKey([{ key: "food" }, { key: "cafe" }]), "food");
    assert.equal(extractCategoryKey([]), undefined);
    assert.equal(extractCategoryKey(null), undefined);
    assert.equal(resolvePartnerCategoryKey({ categories: null }), "health");
  });

  it("orders canonical benefit items and falls back to synthetic legacy ids", () => {
    const canonical = getPartnerBenefitItems(
      createRow({
        partner_benefits: [
          { id: "b-2", title: "두 번째", max_apply_count: 2, display_order: 1 },
          { id: "b-1", title: "첫 번째", max_apply_count: null, display_order: 0 },
        ],
      }),
    );
    assert.deepEqual(
      canonical.map((item) => [item.id, item.title, item.maxApplyCount]),
      [
        ["b-1", "첫 번째", null],
        ["b-2", "두 번째", 2],
      ],
    );

    const legacy = getPartnerBenefitItems(createRow());
    assert.deepEqual(
      legacy.map((item) => item.id),
      ["legacy-benefit-partner-1-1", "legacy-benefit-partner-1-2"],
    );
  });

  it("maps visible partners with the gallery intact and the first image as thumbnail fallback", () => {
    const partner = toVisiblePartner(createRow(), "food");

    assert.equal(partner.thumbnail, "https://img.example.com/1.png");
    assert.deepEqual(partner.images, [
      "https://img.example.com/1.png",
      "https://img.example.com/2.png",
    ]);
    assert.equal(partner.category, "food");
    assert.deepEqual(partner.campusSlugs, ["seoul"]);
    assert.equal(partner.benefitActionType, "external_link");
    assert.deepEqual(partner.period, { start: "미정", end: "미정" });
    assert.deepEqual(partner.benefits, ["10% 할인", "음료 제공"]);
    assert.equal(partner.branchScopeType, "single_location");
    assert.equal(partner.detailDescription, "상세 설명");

    const withThumbnail = toVisiblePartner(
      createRow({ thumbnail: "https://img.example.com/thumb.png" }),
      "food",
    );
    assert.equal(withThumbnail.thumbnail, "https://img.example.com/thumb.png");
  });

  it("locks non-viewable partners without leaking names, locations, or media", () => {
    const locked = toLockedPartner(createRow({ visibility: "confidential" }), "food");

    assert.equal(locked.name, "");
    assert.equal(locked.location, "");
    assert.deepEqual(locked.images, []);
    assert.deepEqual(locked.benefits, []);
    assert.equal(locked.thumbnail, null);
    assert.equal(locked.visibility, "confidential");
  });

  it("keeps public directory summaries lean and omits the gallery", () => {
    const summary = toVisiblePublicDirectorySummaryPartner(createRow(), "food");
    assert.deepEqual(summary.images, []);
    assert.equal(summary.thumbnail, null);
    assert.equal(summary.detailDescription, undefined);

    const lean = mapPartnerForPublicDirectory(createRow(), { authenticated: false });
    assert.deepEqual(lean.images, []);
    assert.deepEqual(lean.benefitItems, []);
    assert.deepEqual(lean.conditions, []);
    assert.deepEqual(lean.benefits, ["10% 할인", "음료 제공"]);
    assert.match(lean.directorySearchText ?? "", /학생증 제시/);
  });

  it("applies list visibility and benefit masking by viewer context", () => {
    const confidential = createRow({ visibility: "confidential" });
    assert.equal(mapPartnerForList(confidential, { authenticated: false }).name, "");
    assert.equal(
      mapPartnerForList(confidential, { authenticated: true }).name,
      "역삼 식당",
    );

    const eligibleOnly = createRow({ benefit_visibility: "eligible_only" });
    assert.deepEqual(
      mapPartnerForList(eligibleOnly, { authenticated: false }).benefits,
      [BENEFIT_LOGIN_REQUIRED_MESSAGE],
    );
    assert.deepEqual(
      mapPartnerForList(eligibleOnly, {
        authenticated: true,
        viewerAudience: "graduate",
      }).benefits,
      [BENEFIT_ELIGIBLE_ONLY_MESSAGE],
    );
    assert.deepEqual(
      mapPartnerForList(eligibleOnly, {
        authenticated: true,
        viewerAudience: "student",
      }).benefits,
      ["10% 할인", "음료 제공"],
    );
  });

  it("gates detail visibility for private, confidential, and expired partners", () => {
    assert.equal(canViewPartnerDetailRow(createRow(), { authenticated: false }), true);
    assert.equal(
      canViewPartnerDetailRow(createRow({ visibility: "private" }), { authenticated: true }),
      false,
    );
    assert.equal(
      canViewPartnerDetailRow(createRow({ visibility: "confidential" }), { authenticated: false }),
      false,
    );
    assert.equal(
      canViewPartnerDetailRow(createRow({ visibility: "confidential" }), { authenticated: true }),
      true,
    );
    assert.equal(
      canViewPartnerDetailRow(
        createRow({ period_start: "2000-01-01", period_end: "2000-01-31" }),
        { authenticated: true },
      ),
      false,
    );
  });

  it("maps detail and raw reads with the same category fallback", () => {
    const row = createRow({ categories: null, benefit_visibility: "eligible_only" });
    assert.equal(mapPartnerRaw(row).category, "health");
    assert.deepEqual(mapPartnerRaw(row).benefits, ["10% 할인", "음료 제공"]);
    assert.deepEqual(
      mapPartnerForDetail(row, { authenticated: false }).benefits,
      [BENEFIT_LOGIN_REQUIRED_MESSAGE],
    );
  });

  it("maps categories and SEO entries with safe defaults", () => {
    assert.deepEqual(mapCategoryRow({ key: null, label: "음식", color: null }), {
      key: "",
      label: "음식",
      description: "",
      color: undefined,
    });
    assert.deepEqual(
      mapPublicPartnerSeoEntry({
        id: "partner-1",
        name: "역삼 식당",
        location: "역삼",
        period_start: null,
        period_end: "2026-12-31",
        categories: [{ label: "음식" }],
      }),
      {
        id: "partner-1",
        name: "역삼 식당",
        categoryLabel: "음식",
        location: "역삼",
        campusSlugs: [],
        createdAt: null,
        period: { start: null, end: "2026-12-31" },
      },
    );
    assert.equal(
      mapPublicPartnerSeoEntry({
        id: "partner-2",
        name: "카페",
        location: "역삼",
        period_start: null,
        period_end: null,
        categories: null,
      }).categoryLabel,
      "제휴",
    );
  });
});
