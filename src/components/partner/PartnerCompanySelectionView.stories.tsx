import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  getPartnerCompanySelectionStoryScenario,
} from "@/lib/mock/scenarios/storybook-partner-portal";
import PartnerCompanySelectionView from "./PartnerCompanySelectionView";

const multiCompanyScenario = getPartnerCompanySelectionStoryScenario(
  "partner.company.selection.multi-company",
);
const emptyScenario = getPartnerCompanySelectionStoryScenario(
  "partner.company.selection.empty",
);

const meta = {
  title: "Domains/Partner/PageStates/CompanySelection",
  component: PartnerCompanySelectionView,
  parameters: {
    chromatic: {
      viewports: [360, 820, 1366],
    },
    mockScenario: {
      routePath: "/partner",
      scenarioIds: [
        "partner.company.selection.multi-company",
        "partner.company.selection.empty",
      ],
    },
  },
} satisfies Meta<typeof PartnerCompanySelectionView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MultiCompany: Story = {
  args: {
    session: multiCompanyScenario.session,
    companies: multiCompanyScenario.companies,
  },
  parameters: {
    mockScenario: {
      routePath: "/partner",
      scenarioId: "partner.company.selection.multi-company",
    },
  },
};

export const Empty: Story = {
  args: {
    session: emptyScenario.session,
    companies: emptyScenario.companies,
  },
  parameters: {
    mockScenario: {
      routePath: "/partner",
      scenarioId: "partner.company.selection.empty",
    },
  },
};
