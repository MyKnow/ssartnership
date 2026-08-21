import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminGlobalSearchResultsView from "./AdminGlobalSearchResultsView";

const meta = {
  title: "Domains/Admin/AdminGlobalSearchResultsView",
  component: AdminGlobalSearchResultsView,
  args: {
    query: "르블라썸 강남점",
    canSearchMembers: true,
    canSearchPartners: true,
    memberSearchFailed: false,
    partnerSearchFailed: false,
    members: [
      {
        id: "mock-member-hong-gildong",
        displayName: "홍길동",
        loginId: "hong.gildong",
        generation: 15,
        campus: "서울",
      },
    ],
    partners: [
      {
        id: "mock-partner-le-blossom-gangnam",
        name: "르블라썸 강남점",
        location: "서울 강남구 테헤란로",
        campusSlugs: ["seoul"],
      },
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-4xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AdminGlobalSearchResultsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Results: Story = {};

export const Empty: Story = {
  args: {
    query: "검색어 없음",
    members: [],
    partners: [],
  },
};

export const PartialFailure: Story = {
  args: {
    memberSearchFailed: true,
    members: [],
  },
};

export const Restricted: Story = {
  args: {
    canSearchMembers: false,
    canSearchPartners: false,
    members: [],
    partners: [],
  },
};

export const LongKorean: Story = {
  args: {
    query: "서울 캠퍼스 장기 교육 과정 제휴처 운영 담당자",
    members: [
      {
        id: "mock-member-long-korean",
        displayName: "서울캠퍼스 장기 교육 과정 운영 지원 담당 구성원",
        loginId: "seoul-campus-long-operation-owner",
        generation: 15,
        campus: "서울 역삼",
      },
    ],
    partners: [
      {
        id: "mock-partner-long-korean",
        name: "역삼역 인근 장기 교육 과정 구성원 전용 제휴 운영 매장",
        location: "서울특별시 강남구 테헤란로 인근 매우 긴 안내 주소와 건물 상세 정보",
        campusSlugs: ["seoul", "gangnam"],
      },
    ],
  },
};
