import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminPartnerManager from "./AdminPartnerManager";
import type { AdminCategory, AdminPartner } from "./partner-manager/types";

const categories: AdminCategory[] = [
  {
    id: "cat-food",
    key: "food",
    label: "식음료",
    description: "식당, 카페, 디저트",
    color: "#2563eb",
  },
  {
    id: "cat-life",
    key: "life",
    label: "생활",
    description: "미용, 편의, 서비스",
    color: "#16a34a",
  },
];

const partners: AdminPartner[] = [
  {
    id: "partner-1",
    name: "역삼 분식랩",
    category_id: "cat-food",
    company_id: "company-1",
    visibility: "public",
    location: "서울 강남구 역삼동 123-4",
    period_start: "2026-04-01",
    period_end: "2026-12-31",
    benefits: ["전 메뉴 10% 할인", "학생증 제시 시 음료 무료 업그레이드"],
    conditions: ["SSAFY 구성원 한정", "포장 가능"],
    applies_to: ["15기", "운영진"],
    tags: ["점심", "혼밥"],
    company: {
      id: "company-1",
      name: "분식랩",
      slug: "bunsik-lab",
      description: "캠퍼스 인근 즉석 분식 브랜드",
      is_active: true,
    },
  },
  {
    id: "partner-2",
    name: "역삼 헤어스튜디오",
    category_id: "cat-life",
    company_id: "company-2",
    visibility: "confidential",
    location: "서울 강남구 역삼로 45",
    reservation_link: "https://example.com/reserve",
    benefits: ["컷 20% 할인"],
    conditions: ["사전 예약 필수"],
    applies_to: ["15기"],
    tags: ["예약필수"],
    company: {
      id: "company-2",
      name: "헤어스튜디오",
      slug: "hair-studio",
      description: "남녀 스타일링 전문",
      is_active: true,
    },
  },
];

const meta = {
  title: "Domains/Admin/AdminPartnerManager",
  component: AdminPartnerManager,
  args: {
    categories,
    partners,
  },
} satisfies Meta<typeof AdminPartnerManager>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    partners: [],
  },
};
