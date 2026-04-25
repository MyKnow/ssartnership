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
  category_id: "cat-food",
  company_id: "company-1",
  visibility: "public",
  location: "서울 강남구 역삼동 123-4",
  period_start: "2026-04-01",
  period_end: "2026-12-31",
  applies_to: ["15기", "운영진"],
  company: {
    id: "company-1",
    name: "분식랩",
    slug: "bunsik-lab",
    description: "캠퍼스 인근 즉석 분식 브랜드",
    is_active: true,
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
      company_id: null,
      metrics: null,
    },
  },
};
