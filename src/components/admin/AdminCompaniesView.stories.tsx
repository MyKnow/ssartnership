import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminCompaniesView from "./AdminCompaniesView";

const companies = [
  {
    id: "company-cafe-ssafy",
    name: "카페 싸피 운영 주식회사",
    slug: "cafe-ssafy",
    description: "서울 캠퍼스 인근 카페와 디저트 제휴처를 운영합니다.",
    is_active: true,
    created_at: "2026-05-02T10:00:00+09:00",
    updated_at: "2026-07-08T16:30:00+09:00",
    brandCount: 3,
    accountCount: 1,
  },
  {
    id: "company-fitness",
    name: "역삼 피트니스 그룹",
    slug: "yeoksam-fitness",
    description: "운동 시설과 건강 관리 프로그램을 제공합니다.",
    is_active: true,
    created_at: "2026-05-12T09:00:00+09:00",
    updated_at: "2026-07-06T11:10:00+09:00",
    brandCount: 1,
    accountCount: 0,
  },
];

const meta = {
  title: "Domains/Admin/AdminCompaniesView",
  component: AdminCompaniesView,
  args: {
    companies,
    accounts: [
      {
        id: "account-cafe-manager",
        login_id: "cafe_ssafy_manager",
        display_name: "카페 싸피 운영 담당자",
        email: "manager@example.com",
        must_change_password: false,
        is_active: true,
        email_verified_at: "2026-05-03T11:00:00+09:00",
        initial_setup_completed_at: "2026-05-03T11:00:00+09:00",
        last_login_at: "2026-07-10T09:20:00+09:00",
        created_at: "2026-05-02T10:30:00+09:00",
        updated_at: "2026-07-10T09:20:00+09:00",
        links: [
          {
            id: "link-cafe-manager",
            is_active: true,
            created_at: "2026-05-02T10:40:00+09:00",
            company: companies[0],
          },
        ],
      },
    ],
    partnerCount: 4,
    initialTab: "companies",
    actions: {
      createCompanyAction: async () => {},
      updateCompanyAction: async () => {},
      deleteCompanyAction: async () => {},
      updateConnectionAction: async () => {},
      createAccountAction: async () => {},
      updateAccountAction: async () => {},
      createSetupUrlAction: async () => {},
      sendSetupUrlAction: async () => {},
    },
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminCompaniesView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
