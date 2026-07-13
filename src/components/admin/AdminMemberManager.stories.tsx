import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminMemberManager from "./AdminMemberManager";
import type { AdminMember } from "./member-manager/selectors";

const members: AdminMember[] = [
  {
    id: "member-seoul-15-001",
    mm_user_id: "mm-user-seoul-15-001",
    mm_username: "seoul15_haneul",
    display_name: "김하늘",
    year: 15,
    campus: "서울",
    must_change_password: false,
    service_policy_version: 3,
    privacy_policy_version: 3,
    marketing_policy_version: 2,
    updated_at: "2026-07-10T09:30:00+09:00",
    created_at: "2026-01-12T10:00:00+09:00",
  },
  {
    id: "member-daejeon-14-002",
    mm_user_id: "mm-user-daejeon-14-002",
    mm_username: "daejeon14_developer_with_long_identifier",
    display_name: "매우 긴 한국어 이름을 사용하는 교육생",
    year: 14,
    campus: "대전 캠퍼스 소프트웨어 마에스트로 협업 교육장",
    must_change_password: true,
    service_policy_version: 2,
    privacy_policy_version: 2,
    marketing_policy_version: null,
    updated_at: "2026-07-09T18:20:00+09:00",
    created_at: "2025-01-13T10:00:00+09:00",
  },
];

const manyMembers: AdminMember[] = Array.from({ length: 12 }).map(
  (_, index) => ({
    ...members[index % members.length]!,
    id: `member-many-${String(index + 1).padStart(2, "0")}`,
    mm_user_id: `mm-user-many-${String(index + 1).padStart(2, "0")}`,
    mm_username: `seoul15_member_${String(index + 1).padStart(2, "0")}`,
    display_name: `서울 캠퍼스 ${index + 1}번째 교육생`,
  }),
);

const filters = {
  searchValue: "",
  sortValue: "recent" as const,
  filterValue: "all" as const,
  yearFilter: "all" as const,
  campusFilter: "all",
  serviceConsentFilter: "all" as const,
  privacyConsentFilter: "all" as const,
  marketingConsentFilter: "all" as const,
  pushEnabledFilter: "all" as const,
  announcementEnabledFilter: "all" as const,
  newPartnerEnabledFilter: "all" as const,
  expiringPartnerEnabledFilter: "all" as const,
  reviewEnabledFilter: "all" as const,
  mmEnabledFilter: "all" as const,
  marketingEnabledFilter: "all" as const,
};

const meta = {
  title: "Domains/Admin/AdminMemberManager",
  component: AdminMemberManager,
  args: {
    members,
    activePolicyVersions: { service: 3, privacy: 3, marketing: 2 },
    pagination: { totalCount: members.length, page: 1, pageSize: 20 },
    filters,
    options: { campuses: ["서울", "대전"], years: [15, 14] },
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberManager>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    members: [],
    pagination: { totalCount: 0, page: 1, pageSize: 20 },
  },
};

export const AdvancedFiltersActive: Story = {
  args: {
    filters: {
      ...filters,
      sortValue: "updated",
      serviceConsentFilter: "pending",
      pushEnabledFilter: "disabled",
    },
  },
};

export const ManyAndPagination: Story = {
  args: {
    members: manyMembers,
    pagination: { totalCount: 97, page: 2, pageSize: 20 },
  },
};

export const LongKorean: Story = {
  args: {
    members: [members[1]!],
    pagination: { totalCount: 1, page: 1, pageSize: 20 },
  },
};

export const Mobile: Story = {
  args: {
    members: [members[1]!],
    pagination: { totalCount: 1, page: 1, pageSize: 20 },
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};

export const Loading: Story = {
  args: { state: "loading" },
};

export const Error: Story = {
  args: {
    state: "error",
    errorMessage: "회원 조회 서비스 응답이 지연되고 있습니다.",
  },
};

export const Unauthorized: Story = {
  args: { state: "unauthorized" },
};

export const Forbidden: Story = {
  args: { state: "forbidden" },
};
