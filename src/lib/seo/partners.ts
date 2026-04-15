import {
  CAMPUS_DIRECTORY,
  getCampusLabelsFromLocation,
  inferCampusSlugsFromLocation,
} from "../campuses.ts";
import {
  SITE_KEYWORDS,
  SITE_LEGACY_NAME,
  SITE_NAME,
} from "../site.ts";
import { buildSiteUrl } from "./index.ts";

export type PartnerSeoTarget = {
  id: string;
  name: string;
  location: string;
  benefits: string[];
  conditions: string[];
  tags?: string[];
  thumbnail?: string | null;
  images?: string[];
  mapUrl?: string;
  period: {
    start: string;
    end: string;
  };
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function toAbsoluteImageUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return buildSiteUrl(trimmed);
  }
  return null;
}

function getPartnerBenefitSnippet(partner: PartnerSeoTarget) {
  return (
    partner.benefits[0] ??
    partner.conditions[0] ??
    partner.tags?.[0] ??
    ""
  ).trim();
}

export function getPartnerCampusAudienceText(location: string) {
  const campusLabels = getCampusLabelsFromLocation(location);
  if (campusLabels.length === CAMPUS_DIRECTORY.length) {
    return "전국 SSAFY 캠퍼스";
  }
  if (campusLabels.length === 1) {
    return campusLabels[0]!;
  }
  if (campusLabels.length > 1) {
    return `${campusLabels.join(", ")} 이용자`;
  }
  return "SSAFY 구성원";
}

export function buildPartnerSeoMetadata(input: {
  partner: PartnerSeoTarget;
  categoryLabel: string;
}) {
  const { partner, categoryLabel } = input;
  const audienceText = getPartnerCampusAudienceText(partner.location);
  const benefitSnippet = getPartnerBenefitSnippet(partner);
  const title = `${partner.name} | ${audienceText} ${categoryLabel} 제휴 혜택 | ${SITE_NAME}(${SITE_LEGACY_NAME})`;
  const description = [
    `${SITE_NAME}에서 ${partner.name} 제휴 혜택을 확인하세요.`,
    `${audienceText}에서 이용 가능한 ${categoryLabel} 제휴입니다.`,
    partner.location ? `${partner.location}에서 이용할 수 있습니다.` : "",
    benefitSnippet ? `대표 혜택: ${benefitSnippet}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const campusKeywords = inferCampusSlugsFromLocation(partner.location).flatMap(
    (slug) => {
      const campus = CAMPUS_DIRECTORY.find((item) => item.slug === slug);
      if (!campus) {
        return [];
      }
      return [
        campus.label,
        `${campus.label} SSAFY 제휴`,
        `${campus.label} 싸피 제휴`,
        `${campus.fullLabel} ${categoryLabel}`,
      ];
    },
  );

  const keywords = uniqueStrings([
    ...SITE_KEYWORDS,
    partner.name,
    partner.location,
    categoryLabel,
    ...campusKeywords,
    ...(partner.tags?.slice(0, 3).map((tag) => `${tag} 제휴`) ?? []),
    ...partner.benefits.slice(0, 3),
    ...partner.conditions.slice(0, 2),
  ]);

  return { title, description, keywords };
}

export function buildPartnerStructuredData(input: {
  partner: PartnerSeoTarget;
  categoryLabel: string;
}) {
  const { partner, categoryLabel } = input;
  const partnerUrl = buildSiteUrl(`/partners/${encodeURIComponent(partner.id)}`);
  const audienceText = getPartnerCampusAudienceText(partner.location);
  const benefitSnippet = getPartnerBenefitSnippet(partner);
  const areaServed = inferCampusSlugsFromLocation(partner.location);
  const imageUrls = uniqueStrings(
    [partner.thumbnail, ...(partner.images ?? [])]
      .map((value) => toAbsoluteImageUrl(value))
      .filter((value): value is string => Boolean(value)),
  );
  const metadata = buildPartnerSeoMetadata(input);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        name: partner.name,
        description: metadata.description,
        url: partnerUrl,
        ...(imageUrls.length > 0 ? { image: imageUrls } : {}),
        ...(partner.location
          ? {
              address: {
                "@type": "PostalAddress",
                streetAddress: partner.location,
                addressCountry: "KR",
              },
            }
          : {}),
        areaServed:
          areaServed.length === CAMPUS_DIRECTORY.length
            ? [{ "@type": "Country", name: "대한민국" }]
            : areaServed.map((slug) => {
                const campus = CAMPUS_DIRECTORY.find((item) => item.slug === slug);
                return {
                  "@type": "AdministrativeArea",
                  name: campus?.fullLabel ?? slug,
                };
              }),
        category: categoryLabel,
        keywords: metadata.keywords.join(", "),
        audience: {
          "@type": "Audience",
          audienceType: audienceText,
        },
        about: [
          {
            "@type": "Thing",
            name: categoryLabel,
          },
          ...areaServed.map((slug) => {
            const campus = CAMPUS_DIRECTORY.find((item) => item.slug === slug);
            return {
              "@type": "AdministrativeArea",
              name: campus?.fullLabel ?? slug,
            };
          }),
        ],
        ...(partner.mapUrl ? { sameAs: [partner.mapUrl] } : {}),
      },
      {
        "@type": "Offer",
        name: `${partner.name} 제휴 혜택`,
        category: categoryLabel,
        description:
          benefitSnippet || `${audienceText} 대상 제휴 혜택을 제공합니다.`,
        availabilityStarts: partner.period.start,
        availabilityEnds: partner.period.end,
        url: partnerUrl,
        eligibleRegion:
          areaServed.length === CAMPUS_DIRECTORY.length
            ? "대한민국"
            : areaServed.map((slug) => {
                const campus = CAMPUS_DIRECTORY.find((item) => item.slug === slug);
                return campus?.fullLabel ?? slug;
              }),
      },
    ],
  };
}
