import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminPartnerRegistrationsView from "./AdminPartnerRegistrationsView";

const meta = {
  title: "Domains/Admin/AdminPartnerRegistrationsView",
  component: AdminPartnerRegistrationsView,
  args: {
    rows: [
      {
        id: "registration-cafe-ssafy",
        status: "pending",
        source: "public_web",
        service_mode: "offline",
        benefit_action_type: "certification",
        branch_scope_type: "single_location",
        branch_scope_note: "서울 캠퍼스 인근 직영점부터 적용합니다.",
        brand_name: "카페 싸피 역삼점",
        category_id: "category-food",
        category_label: "식음료",
        period_start: "2026-07-15",
        period_end: "2027-02-28",
        inquiry_link: "https://example.com/contact",
        brand_phone: "02-1234-5678",
        detail_description: "캠퍼스에서 도보 3분 거리의 카페입니다.",
        company_name: "카페 싸피 운영 주식회사",
        contact_name: "김담당",
        contact_email: "manager@example.com",
        contact_phone: "010-1234-5678",
        company_description: "서울 지역 카페를 운영하는 파트너사입니다.",
        benefits: ["전 메뉴 10% 할인", "디저트 세트 2,000원 할인"],
        conditions: ["SSAFY 모바일 인증 화면 제시"],
        tags: ["역삼", "카페", "스터디"],
        location: "서울특별시 강남구 테헤란로 212 인근",
        map_url: "https://maps.example.com/cafe-ssafy-yeoksam",
        site_link: "https://example.com/cafe-ssafy",
        image_urls: [],
        memo: "오픈 이벤트와 함께 노출 희망",
        admin_note: "사업자 정보 확인 예정",
        reviewed_at: null,
        created_at: "2026-07-10T09:30:00+09:00",
        branches: [
          {
            id: "branch-yeoksam",
            branch_type: "direct",
            campus_slugs: ["seoul"],
          },
        ],
        benefit_groups: [
          { id: "benefit-group-default", group_key: "default", label: "기본 혜택" },
        ],
      },
    ],
    updateStatusAction: async () => {},
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminPartnerRegistrationsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
