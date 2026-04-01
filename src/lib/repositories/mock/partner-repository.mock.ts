import type { Category, Partner } from "@/lib/types";
import type { PartnerRepository } from "@/lib/repositories/partner-repository";
import { canViewPartnerDetails } from "@/lib/partner-visibility";

const categories: Category[] = [
  {
    key: "health",
    label: "헬스",
    description: "운동, PT, 스튜디오",
    color: "#10b981",
  },
  {
    key: "restaurant",
    label: "음식점",
    description: "식사, 술집, 다이닝",
    color: "#f97316",
  },
  {
    key: "cafe",
    label: "카페",
    description: "커피, 디저트, 작업",
    color: "#38bdf8",
  },
  {
    key: "space",
    label: "공간제휴",
    description: "스터디, 회의, 협업",
    color: "#8b5cf6",
  },
];

const partners: Partner[] = [
  {
    id: "health-001",
    name: "바디라인 피트니스",
    category: "health",
    visibility: "public",
    location: "서울 강남구 테헤란로 123, 4층",
    mapUrl: "https://map.kakao.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-123-4567",
    period: { start: "2026-03-01", end: "2026-08-31" },
    benefits: ["월 이용권 20% 할인", "PT 5회 패키지 10% 할인"],
    images: [],
    tags: ["샤워실", "야간운영"],
  },
  {
    id: "restaurant-001",
    name: "역삼 국밥집",
    category: "restaurant",
    visibility: "confidential",
    location: "서울 강남구 역삼로 45",
    mapUrl: "https://map.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-222-3344",
    period: { start: "2026-03-10", end: "2026-12-31" },
    benefits: ["식사 10% 할인", "평일 런치 음료 제공"],
    images: [],
    tags: ["점심추천", "단체석"],
  },
  {
    id: "cafe-001",
    name: "노트북 허브 카페",
    category: "cafe",
    visibility: "private",
    location: "서울 강남구 봉은사로 12",
    mapUrl: "https://map.kakao.com/",
    reservationLink: "https://booking.kakao.com/",
    inquiryLink: "010-9988-7766",
    period: { start: "2026-02-15", end: "2026-09-30" },
    benefits: ["아메리카노 15% 할인", "샌드위치 세트 1,000원 할인"],
    images: [],
    tags: ["콘센트", "회의존"],
  },
  {
    id: "space-001",
    name: "협업 스테이션",
    category: "space",
    visibility: "public",
    location: "서울 강남구 언주로 88, 7층",
    mapUrl: "https://map.naver.com/",
    reservationLink: "https://booking.naver.com/",
    inquiryLink: "02-789-0000",
    period: { start: "2026-01-01", end: "2026-06-30" },
    benefits: ["2시간 무료 이용", "시간권 30% 할인"],
    images: [],
    tags: ["스터디룸", "프로젝터"],
  },
];

export class MockPartnerRepository implements PartnerRepository {
  async getCategories(): Promise<Category[]> {
    return categories;
  }

  async getPartners(context: { authenticated: boolean } = { authenticated: false }): Promise<Partner[]> {
    return partners.map((partner) => {
      if (canViewPartnerDetails(partner.visibility, context.authenticated)) {
        return partner;
      }
      return {
        id: partner.id,
        name: "",
        category: partner.category,
        visibility: partner.visibility,
        location: "",
        period: { start: "", end: "" },
        benefits: [],
        conditions: [],
        images: [],
        tags: [],
      };
    });
  }

  async getPartnerById(
    id: string,
    context: { authenticated: boolean } = { authenticated: false },
  ): Promise<Partner | null> {
    const partner = partners.find((item) => item.id === id) ?? null;
    if (!partner) {
      return null;
    }
    if (!canViewPartnerDetails(partner.visibility, context.authenticated)) {
      return null;
    }
    return partner;
  }
}
