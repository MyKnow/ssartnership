import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import AdminMemberProfilePhotoPanel from "./AdminMemberProfilePhotoPanel";

const noOp = async () => undefined;
const SAMPLE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL8igAAAABJRU5ErkJggg==";

function createSamplePhoto() {
  const bytes = Uint8Array.from(atob(SAMPLE_PNG_BASE64), (character) => character.charCodeAt(0));
  return new File([bytes], "관리자-프로필.png", { type: "image/png" });
}

const meta = {
  title: "Screens/Admin/MemberProfilePhotoPanel",
  component: AdminMemberProfilePhotoPanel,
  args: {
    memberId: "00000000-0000-4000-8000-000000000001",
    reviewStatus: "approved",
    pendingImageId: null,
    canUpdate: true,
    approveAction: noOp,
    rejectReplacementAction: noOp,
    rejectCurrentAction: noOp,
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberProfilePhotoPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Approved: Story = {};

export const Pending: Story = {
  args: {
    reviewStatus: "pending",
    pendingImageId: null,
  },
};

export const SelectedPhoto: Story = {
  play: async () => {
    const body = within(document.body);
    const input = body.getByLabelText("새 프로필 사진 파일 선택");
    await userEvent.upload(input, createSamplePhoto());
    await expect(await body.findByText("프로필 사진 자르기")).toBeInTheDocument();

    const applyButton = body.getByRole("button", { name: "적용" });
    await waitFor(() => expect(applyButton).toBeEnabled());
    await userEvent.click(applyButton);

    await expect(await body.findByAltText("변경할 프로필 사진 미리보기")).toBeInTheDocument();
  },
};

export const ReadOnly: Story = {
  args: {
    canUpdate: false,
    reviewStatus: "rejected",
  },
};
