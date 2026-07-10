import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminAdvertisementView from "./AdminAdvertisementView";

const meta = {
  title: "Domains/Admin/AdminAdvertisementView",
  component: AdminAdvertisementView,
  args: {
    campaigns: [],
    partners: [
      { id: "partner-cafe-ssafy", name: "카페 싸피 역삼점" },
      { id: "partner-fitness", name: "역삼 피트니스" },
    ],
    createCampaignAction: async () => {},
    updateCampaignStatusAction: async () => {},
    createCouponAction: async () => {},
    initialSlides: [],
    eventPageOptions: [
      {
        href: "/events/launch",
        slug: "launch",
        label: "싸트너십 오픈 이벤트 (/events/launch)",
      },
    ],
    adCampaignOptions: [],
    saveAction: async () => {},
    message: null,
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminAdvertisementView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
