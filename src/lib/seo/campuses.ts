import {
  type CampusSlug,
  getCampusBySlug,
  getCampusPageHref,
} from "../campuses.ts";
import {
  SITE_KEYWORDS,
  SITE_LEGACY_NAME,
  SITE_NAME,
} from "../site.ts";
import { buildSiteUrl } from "./index.ts";

export type CampusSeoPartner = {
  id: string;
  name: string;
  category: string;
  location: string;
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function buildCampusSeoMetadata(input: {
  campusSlug: CampusSlug;
  partnerCount: number;
  categoryLabels: string[];
}) {
  const campus = getCampusBySlug(input.campusSlug);
  if (!campus) {
    return null;
  }

  const title = `${campus.fullLabel} SSAFY 제휴 혜택 | ${SITE_NAME}(${SITE_LEGACY_NAME})`;
  const description = [
    `${campus.fullLabel}에서 이용할 수 있는 SSAFY 제휴 혜택을 확인하세요.`,
    input.partnerCount > 0
      ? `${input.partnerCount}개의 공개 제휴가 준비되어 있습니다.`
      : "현재 공개된 제휴를 빠르게 확인할 수 있습니다.",
    input.categoryLabels.length > 0
      ? `${input.categoryLabels.slice(0, 3).join(", ")} 카테고리 중심으로 살펴볼 수 있습니다.`
      : campus.description,
  ]
    .filter(Boolean)
    .join(" ");

  const keywords = uniqueStrings([
    ...SITE_KEYWORDS,
    campus.label,
    campus.fullLabel,
    `${campus.label} SSAFY 제휴`,
    `${campus.label} 싸피 제휴`,
    `${campus.fullLabel} 제휴 혜택`,
    ...input.categoryLabels.map((label) => `${campus.label} ${label} 제휴`),
  ]);

  return { campus, title, description, keywords };
}

export function buildCampusStructuredData(input: {
  campusSlug: CampusSlug;
  partners: CampusSeoPartner[];
  categoryLabels?: string[];
}) {
  const campus = getCampusBySlug(input.campusSlug);
  if (!campus) {
    return null;
  }

  const keywords = uniqueStrings([
    campus.label,
    campus.fullLabel,
    `${campus.label} SSAFY 제휴`,
    `${campus.label} 싸피 제휴`,
    ...(input.categoryLabels ?? []),
  ]);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: `${campus.fullLabel} 제휴 혜택`,
        description: campus.description,
        url: buildSiteUrl(getCampusPageHref(campus.slug)),
        keywords: keywords.join(", "),
        about: {
          "@type": "Thing",
          name: `${campus.fullLabel} 제휴 카테고리`,
          additionalType: "https://schema.org/DefinedTermSet",
          hasPart: [
            {
              "@type": "AdministrativeArea",
              name: campus.fullLabel,
            },
            ...(input.categoryLabels ?? []).map((label) => ({
              "@type": "DefinedTerm",
              name: label,
            })),
          ],
        },
      },
      {
        "@type": "ItemList",
        name: `${campus.fullLabel} 제휴 목록`,
        itemListElement: input.partners.slice(0, 20).map((partner, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: buildSiteUrl(`/partners/${encodeURIComponent(partner.id)}`),
          name: partner.name,
        })),
      },
    ],
  };
}
