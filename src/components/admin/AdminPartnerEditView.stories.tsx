import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import PartnerCardForm from "@/components/PartnerCardForm";

const meta = {
  title: "Domains/Admin/AdminPartnerEditView",
  component: PartnerCardForm,
  args: {
    mode: "edit",
    partner: {
      id: "partner-cafe-ssafy-yeoksam",
      name: "카페 싸피 역삼점",
      visibility: "public",
      benefitVisibility: "public",
      location: "서울특별시 강남구 테헤란로 212 인근",
      detailDescription: "캠퍼스에서 도보 3분 거리의 제휴 카페입니다.",
      campusSlugs: ["seoul"],
      mapUrl: "https://maps.example.com/cafe-ssafy-yeoksam",
      benefitActionType: "certification",
      benefitActionLink: "",
      reservationLink: "https://example.com/reservation",
      inquiryLink: "https://example.com/contact",
      period: { start: "2026-07-15", end: "2027-02-28" },
      conditions: ["SSAFY 모바일 인증 화면 제시"],
      benefits: ["전 메뉴 10% 할인", "디저트 세트 2,000원 할인"],
      appliesTo: ["student", "staff"],
      thumbnail: null,
      images: [],
      tags: ["역삼", "카페", "스터디"],
      company: {
        id: "company-cafe-ssafy",
        name: "카페 싸피 운영 주식회사",
        description: "서울 지역 카페를 운영하는 파트너사입니다.",
        contactName: "김담당",
        contactEmail: "manager@example.com",
        contactPhone: "010-1234-5678",
      },
    },
    categoryOptions: [
      { id: "category-food", key: "food", label: "식음료" },
      { id: "category-life", key: "life", label: "생활/편의" },
    ],
    companyOptions: [
      {
        id: "company-cafe-ssafy",
        name: "카페 싸피 운영 주식회사",
        slug: "cafe-ssafy",
      },
    ],
    categoryId: "category-food",
    formAction: async () => {},
    deleteAction: async () => {},
    submitLabel: "제휴처 저장",
    hiddenFields: [
      {
        name: "updateRedirectTo",
        value: "/admin/partners/partner-cafe-ssafy-yeoksam",
      },
    ],
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof PartnerCardForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
