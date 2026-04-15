export type CampusSlug =
  | "seoul"
  | "gumi"
  | "daejeon"
  | "busan-ulsan-gyeongnam"
  | "gwangju";

export type CampusPartnerLike = {
  location: string;
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

export function getCampusBySlug(slug: string) {
  return CAMPUS_DIRECTORY.find((campus) => campus.slug === slug) ?? null;
}

export function getCampusPageHref(slug: CampusSlug) {
  return `/campuses/${slug}`;
}

export function isNationwideCampusLocation(location: string) {
  return /전국/.test(location);
}

export function inferCampusSlugsFromLocation(location: string) {
  const normalized = location.trim();
  if (!normalized) {
    return [];
  }
  if (isNationwideCampusLocation(normalized)) {
    return CAMPUS_DIRECTORY.map((campus) => campus.slug);
  }
  return CAMPUS_DIRECTORY.filter((campus) =>
    campus.patterns.some((pattern) => pattern.test(normalized)),
  ).map((campus) => campus.slug);
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
  return inferCampusSlugsFromLocation(partner.location).includes(campusSlug);
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
