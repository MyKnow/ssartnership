import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import PartnerCampusSlugField from "./PartnerCampusSlugField";
const meta = {
  title: "Domains/PartnerCardForm/CampusSlugField",
  component: PartnerCampusSlugField,
  args: { defaultValue: ["seoul"], location: "서울 강남구" },
} satisfies Meta<typeof PartnerCampusSlugField>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Selected: Story = {};
export const AllCampuses: Story = { args: { defaultValue: ["seoul", "daejeon", "gwangju", "gumi", "busan-ulsan-gyeongnam"] } };
export const Error: Story = { args: { error: "하나 이상의 캠퍼스를 선택해 주세요." } };
export const Toggle: Story = {
  play: async ({ canvasElement }) => {
    const seoul = within(canvasElement).getByRole("checkbox", { name: /^서울 캠퍼스$/ });
    await expect(seoul).toBeChecked();
    await userEvent.click(seoul);
    await expect(seoul).not.toBeChecked();
    await userEvent.click(seoul);
    await expect(seoul).toBeChecked();
  },
};
