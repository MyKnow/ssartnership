export type CampusSlug =
  | "seoul"
  | "gumi"
  | "daejeon"
  | "busan-ulsan-gyeongnam"
  | "gwangju";

export type CampusPartnerLike = {
  location: string;
  campusSlugs?: string[] | null;
};

export type CampusSummary = {
  slug: CampusSlug;
  label: string;
  fullLabel: string;
  description: string;
  href: string;
  partnerCount: number;
};

export const CAMPUS_DIRECTORY: Array<{
  slug: CampusSlug;
  label: string;
  fullLabel: string;
  description: string;
  patterns: RegExp[];
}> = [
  {
    slug: "seoul",
    label: "서울",
    fullLabel: "서울 캠퍼스",
    description: "역삼역과 강남권에서 이용할 수 있는 제휴 혜택을 모았습니다.",
    patterns: [
      /서울/,
      /강남/,
      /역삼/,
      /역삼역/,
      /선릉/,
      /테헤란/,
      /봉은사/,
      /논현/,
    ],
  },
  {
    slug: "gumi",
    label: "구미",
    fullLabel: "구미 캠퍼스",
    description: "구미 지역에서 이용할 수 있는 SSAFY 제휴 혜택을 모았습니다.",
    patterns: [/구미/, /경북/, /경상북도/],
  },
  {
    slug: "daejeon",
    label: "대전",
    fullLabel: "대전 캠퍼스",
    description: "대전 지역에서 이용할 수 있는 SSAFY 제휴 혜택을 모았습니다.",
    patterns: [/대전/, /유성/, /둔산/],
  },
  {
    slug: "busan-ulsan-gyeongnam",
    label: "부울경",
    fullLabel: "부울경 캠퍼스",
    description: "부산·울산·경남 지역에서 이용할 수 있는 SSAFY 제휴 혜택을 모았습니다.",
    patterns: [
      /부산/,
      /울산/,
      /경남/,
      /창원/,
      /김해/,
      /양산/,
      /해운대/,
      /서면/,
    ],
  },
  {
    slug: "gwangju",
    label: "광주",
    fullLabel: "광주 캠퍼스",
    description: "광주 지역에서 이용할 수 있는 SSAFY 제휴 혜택을 모았습니다.",
    patterns: [/광주/, /전남/],
  },
];

export const CAMPUS_SLUGS = CAMPUS_DIRECTORY.map((campus) => campus.slug);

export function getCampusBySlug(slug: string) {
  return CAMPUS_DIRECTORY.find((campus) => campus.slug === slug) ?? null;
}

export function getCampusPageHref(slug: CampusSlug) {
  return `/campuses/${slug}`;
}

export function isNationwideCampusLocation(location: string) {
  return /전국/.test(location);
}

export function isAllCampusLocation(location: string) {
  return /전국|전\s*지점|전체\s*지점|모든\s*지점|전\s*매장|전체\s*매장|모든\s*매장/.test(location);
}

export function isCampusSlug(value: string): value is CampusSlug {
  return CAMPUS_SLUGS.includes(value as CampusSlug);
}

export function normalizeCampusSlugs(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(isCampusSlug),
    ),
  );
}

export function inferCampusSlugsFromLocation(location: string) {
  const normalized = location.trim();
  if (!normalized) {
    return [];
  }
  if (isAllCampusLocation(normalized)) {
    return [...CAMPUS_SLUGS];
  }
  return CAMPUS_DIRECTORY.filter((campus) =>
    campus.patterns.some((pattern) => pattern.test(normalized)),
  ).map((campus) => campus.slug);
}

export function resolvePartnerCampusSlugs(partner: CampusPartnerLike) {
  const explicitSlugs = normalizeCampusSlugs(partner.campusSlugs ?? []);
  if (explicitSlugs.length > 0) {
    return explicitSlugs;
  }
  return inferCampusSlugsFromLocation(partner.location);
}

export function resolveFormCampusSlugs(values: string[], _location: string) {
  void _location;
  return normalizeCampusSlugs(values);
}

export function validateFormCampusSlugSelection(values: string[], location: string) {
  const campusSlugs = resolveFormCampusSlugs(values, location);
  return {
    ok: campusSlugs.length > 0,
    campusSlugs,
  };
}

export function getCampusLabelsFromLocation(location: string) {
  return inferCampusSlugsFromLocation(location)
    .map((slug) => getCampusBySlug(slug))
    .filter((campus): campus is NonNullable<typeof campus> => Boolean(campus))
    .map((campus) => campus.fullLabel);
}

export function doesPartnerMatchCampus(
  partner: CampusPartnerLike,
  campusSlug: CampusSlug,
) {
  return resolvePartnerCampusSlugs(partner).includes(campusSlug);
}

export function getCampusPartners<T extends CampusPartnerLike>(
  partners: T[],
  campusSlug: CampusSlug,
) {
  return partners.filter((partner) => doesPartnerMatchCampus(partner, campusSlug));
}

export function getCampusSummaries<T extends CampusPartnerLike>(partners: T[]) {
  return CAMPUS_DIRECTORY.map((campus) => ({
    ...campus,
    href: getCampusPageHref(campus.slug),
    partnerCount: getCampusPartners(partners, campus.slug).length,
  })) satisfies CampusSummary[];
}
