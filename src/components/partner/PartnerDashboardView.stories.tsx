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
    session: cafeSsafyScenario.session,
    dashboard: cafeSsafyScenario.dashboard,
    selectedCompany: cafeSsafyScenario.selectedCompany,
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
    session: emptyScenario.session,
    dashboard: emptyScenario.dashboard,
    selectedCompany: emptyScenario.selectedCompany,
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
    session: pendingReviewScenario.session,
    dashboard: pendingReviewScenario.dashboard,
    selectedCompany: pendingReviewScenario.selectedCompany,
  },
  parameters: {
    mockScenario: {
      routePath: "/partner/companies/[companyId]",
      scenarioId: "partner.company.dashboard.pending-review",
    },
  },
};
