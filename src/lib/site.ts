export const SITE_NAME = "싸트너십";
export const SITE_LEGACY_NAME = "SSARTNERSHIP";
export const SITE_TITLE =
  "싸트너십 | SSAFY 구성원을 위한 제휴 혜택 플랫폼";
export const SSAFY_SHORT_NAME = "SSAFY";
export const SSAFY_SHORT_KOR_NAME = "싸피";
export const SSAFY_FULL_NAME = "삼성 청년 SW·AI 아카데미";
export const SITE_DESCRIPTION =
  "싸트너십(SSARTNERSHIP)은 SSAFY 구성원을 위한 제휴 혜택 플랫폼입니다. 싸피 제휴 업체와 혜택 정보를 한곳에서 빠르게 확인하세요.";

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

const SITE_BRAND_KEYWORDS = [
  "싸트너십",
  "SSARTNERSHIP",
  "SSARTNERSHIP SEOUL",
  "SSARTNERSHIP SSAFY",
  "삼성 청년 SW·AI 아카데미",
  "삼성청년SW아카데미",
  "삼성 청년 SW 아카데미",
  "SSAFY",
  "SSAFY 서울",
  "SSAFY 서울 캠퍼스",
  "싸피",
  "싸피 서울",
  "싸피 서울 캠퍼스",
  "싸피 구성원",
  "SSAFY 구성원",
];

const SITE_CAMPUS_KEYWORDS = [
  "SSAFY 서울",
  "싸피 서울",
  "SSAFY 서울 캠퍼스",
  "싸피 서울 캠퍼스",
  "SSAFY 역삼",
  "싸피 역삼",
  "SSAFY 역삼역",
  "싸피 역삼역",
  "SSAFY 구미",
  "싸피 구미",
  "SSAFY 구미 캠퍼스",
  "싸피 구미 캠퍼스",
  "SSAFY 대전",
  "싸피 대전",
  "SSAFY 대전 캠퍼스",
  "싸피 대전 캠퍼스",
  "SSAFY 부울경",
  "싸피 부울경",
  "SSAFY 부울경 캠퍼스",
  "싸피 부울경 캠퍼스",
  "SSAFY 광주",
  "싸피 광주",
  "SSAFY 광주 캠퍼스",
  "싸피 광주 캠퍼스",
];

const SITE_BOOTCAMP_KEYWORDS = [
  "개발자 부트캠프",
  "SW 부트캠프",
  "AI 부트캠프",
  "프로그래밍 부트캠프",
  "코딩 부트캠프",
  "취업 부트캠프",
  "삼성 부트캠프",
  "개발 교육",
  "개발자 교육",
  "소프트웨어 교육",
  "AI 교육",
  "개발자 양성",
  "SW 교육 과정",
  "AI 교육 과정",
  "개발자 취업 교육",
  "개발자 취업 준비",
  "실무형 개발자 교육",
  "국비 부트캠프",
  "개발자 아카데미",
  "SW 아카데미",
];

const SITE_SAMSUNG_KEYWORDS = [
  "삼성",
  "삼성 청년 SW 아카데미",
  "삼성 청년 SW·AI 아카데미",
  "삼성청년SW아카데미",
  "삼성청년SWAI아카데미",
  "삼성 SW 아카데미",
  "삼성 AI 아카데미",
  "삼성 개발자 교육",
  "삼성 소프트웨어 교육",
  "삼성 취업 교육",
  "삼성 청년 교육",
];

const SITE_PARTNERSHIP_KEYWORDS = [
  "SSAFY 제휴",
  "싸피 제휴",
  "SSAFY(싸피) 제휴",
  "SSAFY 제휴 혜택",
  "싸피 제휴 혜택",
  "서울 캠퍼스 제휴",
  "역삼 제휴",
  "역삼역 제휴",
  "강남 제휴",
  "강남역 인근 제휴",
  "학생 제휴 할인",
  "교육생 제휴 할인",
  "제휴 혜택",
  "제휴 할인",
  "할인 혜택",
  "복지 혜택",
  "제휴 업체",
  "제휴 브랜드",
  "제휴 플랫폼",
  "캠퍼스 제휴",
  "교육생 제휴",
  "학생 복지 제휴",
  "부트캠프 제휴",
  "개발자 제휴 혜택",
  "제휴 정보",
  "제휴 안내",
  "제휴 이벤트",
  "혜택 플랫폼",
];

const SITE_DISCOVERY_KEYWORDS = [
  "SSAFY 맛집 할인",
  "싸피 맛집 할인",
  "SSAFY 카페 할인",
  "싸피 카페 할인",
  "SSAFY 헬스 할인",
  "싸피 헬스 할인",
  "SSAFY 스터디카페 할인",
  "싸피 스터디카페 할인",
  "SSAFY 서울 맛집",
  "싸피 서울 맛집",
  "SSAFY 역삼 맛집",
  "싸피 역삼 맛집",
  "SSAFY 역삼역 카페",
  "싸피 역삼역 카페",
  "SSAFY 강남 제휴",
  "싸피 강남 제휴",
  "SSAFY 주변 제휴",
  "싸피 주변 제휴",
  "서울 SSAFY 혜택",
  "서울 싸피 혜택",
];

export const SITE_KEYWORDS = uniqueStrings([
  ...SITE_BRAND_KEYWORDS,
  ...SITE_CAMPUS_KEYWORDS,
  ...SITE_BOOTCAMP_KEYWORDS,
  ...SITE_SAMSUNG_KEYWORDS,
  ...SITE_PARTNERSHIP_KEYWORDS,
  ...SITE_DISCOVERY_KEYWORDS,
]);

export const SITE_ALTERNATE_NAMES = uniqueStrings([
  "싸트너십",
  "SSARTNERSHIP",
  "싸트너십 SSARTNERSHIP",
  "싸트너십 SSAFY",
  "싸트너십 서울",
  "싸트너십 서울 캠퍼스",
  "싸트너십 구미 캠퍼스",
  "싸트너십 대전 캠퍼스",
  "싸트너십 부울경 캠퍼스",
  "싸트너십 광주 캠퍼스",
  "SSAFY 제휴",
  "SSAFY 제휴 플랫폼",
  "싸피 제휴",
  "싸피 제휴 플랫폼",
  "서울 캠퍼스 제휴",
  "구미 캠퍼스 제휴",
  "대전 캠퍼스 제휴",
  "부울경 캠퍼스 제휴",
  "광주 캠퍼스 제휴",
  "서울 SSAFY 제휴",
  "구미 SSAFY 제휴",
  "대전 SSAFY 제휴",
  "부울경 SSAFY 제휴",
  "광주 SSAFY 제휴",
  "서울 싸피 제휴",
  "구미 싸피 제휴",
  "대전 싸피 제휴",
  "부울경 싸피 제휴",
  "광주 싸피 제휴",
  "역삼역 SSAFY 제휴",
  "역삼역 싸피 제휴",
  "삼성 청년 SW·AI 아카데미",
  "삼성청년SW아카데미",
  "개발자 부트캠프 제휴",
  "삼성 부트캠프 제휴",
  "SSAFY(싸피) 제휴",
]);
export const SITE_URL =
  (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ssartnership.vercel.app").replace(
    /\/+$/,
    "",
  );
export const SITE_RSS_URL = "/rss.xml";

export const GITHUB_URL = "https://github.com/MyKnow";
export const INSTAGRAM_URL = "https://instagram.com/myknow00";
export const BUG_REPORT_EMAIL = "myknow@ssafy.com";
