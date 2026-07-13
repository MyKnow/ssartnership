import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  getPartnerDashboardStoryScenario,
} from "@/lib/mock/scenarios/storybook-partner-portal";
import PartnerDashboardView from "./PartnerDashboardView";

const cafeSsafyScenario = getPartnerDashboardStoryScenario(
  "partner.company.dashboard.cafe-ssafy-mixed-plans",
);
const emptyScenario = getPartnerDashboardStoryScenario(
  "partner.company.dashboard.empty",
);
const pendingReviewScenario = getPartnerDashboardStoryScenario(
  "partner.company.dashboard.pending-review",
);
const longKoreanDashboard = {
  ...cafeSsafyScenario.dashboard,
  companies: cafeSsafyScenario.dashboard.companies.map((company, index) =>
    index === 0
      ? {
          ...company,
          name: "역삼역과 선릉역 사이 여러 지점을 운영하는 긴 이름의 파트너사",
          description:
            "서울 캠퍼스 교육생이 학습과 식사를 함께 해결할 수 있도록 다양한 제휴처와 여러 조건의 혜택을 운영합니다.",
          services: company.services.map((service, serviceIndex) =>
            serviceIndex === 0
              ? {
                  ...service,
                  name: "매우 긴 한국어 제휴처 이름에서도 한 줄 말줄임과 모바일 폭이 안전한 역삼본점",
                  location:
                    "서울특별시 강남구 테헤란로 아주 긴 건물 이름과 상세 층수 123동 45층",
                }
              : service,
          ),
        }
      : company,
  ),
};
const rejectedDashboard = {
  ...pendingReviewScenario.dashboard,
  companies: pendingReviewScenario.dashboard.companies.map((company, index) =>
    index === 0
      ? {
          ...company,
          services: company.services.map((service, serviceIndex) =>
            serviceIndex === company.services.length - 1
              ? { ...service, status: "rejected" as const }
              : service,
          ),
        }
      : company,
  ),
};

const meta = {
  title: "Domains/Partner/PageStates/Dashboard",
  component: PartnerDashboardView,
  parameters: {
    chromatic: {
      viewports: [360, 820, 1366],
    },
    mockScenario: {
      routePath: "/partner/companies/[companyId]",
      scenarioIds: [
        "partner.company.dashboard.cafe-ssafy-mixed-plans",
        "partner.company.dashboard.empty",
        "partner.company.dashboard.pending-review",
      ],
    },
  },
} satisfies Meta<typeof PartnerDashboardView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CafeSsafyMixedPlans: Story = {
  args: {
    dashboard: cafeSsafyScenario.dashboard,
  },
  parameters: {
    mockScenario: {
      routePath: "/partner/companies/[companyId]",
      scenarioId: "partner.company.dashboard.cafe-ssafy-mixed-plans",
    },
  },
};

export const Empty: Story = {
  args: {
    dashboard: emptyScenario.dashboard,
  },
  parameters: {
    mockScenario: {
      routePath: "/partner/companies/[companyId]",
      scenarioId: "partner.company.dashboard.empty",
    },
  },
};

export const PendingReview: Story = {
  args: {
    dashboard: pendingReviewScenario.dashboard,
  },
  parameters: {
    mockScenario: {
      routePath: "/partner/companies/[companyId]",
      scenarioId: "partner.company.dashboard.pending-review",
    },
  },
};

export const LongKoreanMobile: Story = {
  args: {
    dashboard: longKoreanDashboard,
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
    mockScenario: {
      routePath: "/partner/companies/[companyId]",
      scenarioId: "partner.company.dashboard.cafe-ssafy-mixed-plans",
    },
  },
};

export const RejectedReview: Story = {
  args: {
    dashboard: rejectedDashboard,
  },
  parameters: {
    mockScenario: {
      routePath: "/partner/companies/[companyId]",
      scenarioId: "partner.company.dashboard.pending-review",
    },
  },
};
