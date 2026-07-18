import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminMemberManager from "./AdminMemberManager";
import type { AdminMember } from "./member-manager/selectors";

const members: AdminMember[] = [
  {
    id: "member-seoul-15-001",
    mmUserId: "mm-user-seoul-15-001",
    mmUsername: "seoul15_haneul",
    displayName: "김하늘",
    generation: 15,
    campus: "서울",
    mustChangePassword: false,
    serviceConsent: true,
    privacyConsent: true,
    marketingConsent: true,
    hasProfileImage: true,
    updatedAt: "2026-07-10T09:30:00+09:00",
    createdAt: "2026-01-12T10:00:00+09:00",
  },
  {
    id: "member-daejeon-14-002",
    mmUserId: "mm-user-daejeon-14-002",
    mmUsername: "daejeon14_developer_with_long_identifier",
    displayName: "매우 긴 한국어 이름을 사용하는 교육생",
    generation: 14,
    campus: "대전 캠퍼스 소프트웨어 마에스트로 협업 교육장",
    mustChangePassword: true,
    serviceConsent: false,
    privacyConsent: false,
    marketingConsent: false,
    hasProfileImage: false,
    updatedAt: "2026-07-09T18:20:00+09:00",
    createdAt: "2025-01-13T10:00:00+09:00",
  },
];

const manyMembers: AdminMember[] = Array.from({ length: 12 }).map(
  (_, index) => ({
    ...members[index % members.length]!,
    id: `member-many-${String(index + 1).padStart(2, "0")}`,
    mmUserId: `mm-user-many-${String(index + 1).padStart(2, "0")}`,
    mmUsername: `seoul15_member_${String(index + 1).padStart(2, "0")}`,
    displayName: `서울 캠퍼스 ${index + 1}번째 교육생`,
  }),
);

const filters = {
  searchValue: "",
  sortValue: "recent" as const,
  filterValue: "all" as const,
  mattermostLifecycleFilter: "all" as const,
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

export const LifecycleFiltersActive: Story = {
  args: {
    filters: {
      ...filters,
      mattermostLifecycleFilter: "disabled",
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
