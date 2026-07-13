import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PARTNER_CREATE_FORM_INITIAL_STATE } from "@/lib/partner-form-state";
import AdminPartnerNewView from "./AdminPartnerNewView";

const meta = {
  title: "Domains/Admin/AdminPartnerNewView",
  component: AdminPartnerNewView,
  args: {
    partner: {
      name: "",
      visibility: "public",
      benefitVisibility: "public",
      location: "",
      detailDescription: "",
      campusSlugs: ["seoul"],
      mapUrl: "",
      benefitActionType: "none",
      benefitActionLink: "",
      reservationLink: "",
      inquiryLink: "",
      period: { start: "", end: "" },
      conditions: [],
      benefits: [],
      appliesTo: [],
      thumbnail: null,
      images: [],
      tags: [],
      company: null,
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
    createAction: async () => PARTNER_CREATE_FORM_INITIAL_STATE,
    parseFileAction: async () => ({
      ok: false,
      errors: ["Story에서는 XLSX 파일 검증을 실행하지 않습니다."],
    }),
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminPartnerNewView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
