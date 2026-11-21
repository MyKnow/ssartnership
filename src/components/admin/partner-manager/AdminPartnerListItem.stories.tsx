import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminPartnerListItem from "./AdminPartnerListItem";
import type { AdminCategory, AdminPartner } from "./types";

const category: AdminCategory = {
  id: "cat-food",
  key: "food",
  label: "식음료",
  description: "식당, 카페, 디저트",
  color: "#2563eb",
};

const partner: AdminPartner = {
  id: "partner-1",
  name: "역삼 분식랩",
  categoryId: "cat-food",
  companyId: "company-1",
  visibility: "public",
  location: "서울 강남구 역삼동 123-4",
  managedCampusSlugs: ["seoul"],
  mapUrl: null,
  periodStart: "2026-04-01",
  periodEnd: "2026-12-31",
  appliesTo: ["15기", "운영진"],
  company: {
    id: "company-1",
    name: "분식랩",
    slug: "bunsik-lab",
  },
  metrics: {
    favoriteCount: 113,
    cardClicks: 742,
    detailViews: 2140,
    detailUv: 1670,
    totalClicks: 588,
    mapClicks: 121,
    reservationClicks: 102,
    inquiryClicks: 76,
    reviewCount: 29,
  },
};

const meta = {
  title: "Domains/Admin/AdminPartnerListItem",
  component: AdminPartnerListItem,
  args: {
    partner,
    category,
  },
} satisfies Meta<typeof AdminPartnerListItem>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConfidentialWithoutCompany: Story = {
  args: {
    partner: {
      ...partner,
      visibility: "confidential",
      company: null,
      companyId: null,
      metrics: null,
    },
  },
};

export const LongKoreanContent: Story = {
  args: {
    partner: {
      ...partner,
      name: "서울 캠퍼스 구성원을 위한 긴 이름의 체형 교정과 건강 관리 전문 제휴처",
      location: "서울특별시 강남구 테헤란로 인근에서 운영하는 예약 기반 체형 교정 및 건강 관리 서비스",
      company: {
        ...partner.company!,
        name: "서울 캠퍼스 구성원 건강 관리 협력 운영사",
      },
    },
  },
};
