import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Select from "./Select";

const meta = {
  title: "UI/Select",
  component: Select,
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="max-w-xs">
      <Select defaultValue="latest">
        <option value="latest">최신순</option>
        <option value="popular">인기순</option>
        <option value="rating">평점순</option>
      </Select>
    </div>
  ),
};
