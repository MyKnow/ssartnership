import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminCategoryManager from "./AdminCategoryManager";

const categories = [
  {
    id: "category-food",
    key: "food",
    label: "식음료",
    description: "식당, 카페, 디저트 등 캠퍼스 인근에서 이용할 수 있는 식음료 제휴처",
    color: "#2563eb",
  },
  {
    id: "category-life",
    key: "life",
    label: "생활/편의",
    description: "미용, 세탁, 운동, 편의시설을 포함하는 생활 밀착형 제휴처",
    color: "#16a34a",
  },
];

const meta = {
  title: "Domains/Admin/AdminCategoryManager",
  component: AdminCategoryManager,
  args: {
    categories,
    createAction: async () => {},
    updateAction: async () => {},
    canCreate: true,
    canUpdate: true,
    usageCountById: {
      "category-food": 18,
      "category-life": 0,
    },
  },
  parameters: {
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminCategoryManager>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { categories: [] },
};

export const Readonly: Story = {
  args: { canCreate: false, canUpdate: false },
};
