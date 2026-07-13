import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminProfilePhotoReviewQueue from "./AdminProfilePhotoReviewQueue";

const noop = async () => undefined;
const syntheticPhoto =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='640' viewBox='0 0 640 640'%3E%3Crect width='640' height='640' fill='%231c3f75'/%3E%3Ccircle cx='320' cy='250' r='120' fill='%23d9b18c'/%3E%3Cpath d='M130 610c38-166 120-226 190-226s152 60 190 226' fill='%234c2c20'/%3E%3C/svg%3E";

const meta = {
  title: "Domains/Admin/ProfilePhotoReviewQueue",
  component: AdminProfilePhotoReviewQueue,
  args: {
    replacements: [
      {
        id: "00000000-0000-4000-8000-000000000201",
        member_id: "00000000-0000-4000-8000-000000000202",
        created_at: "2026-07-12T00:00:00.000Z",
        member: {
          id: "00000000-0000-4000-8000-000000000202",
          display_name: "긴 이름의 합성 수료생 회원",
          year: 15,
        },
      },
    ],
    currentPhotos: [
      {
        id: "00000000-0000-4000-8000-000000000203",
        display_name: "기존 프로필 사진 점검 대상",
        year: 14,
        updated_at: "2026-07-11T00:00:00.000Z",
      },
    ],
    actions: {
      approveReplacement: noop,
      rejectReplacement: noop,
      rejectCurrentPhoto: noop,
    },
    replacementImageUrl: () => syntheticPhoto,
    currentPhotoUrl: () => syntheticPhoto,
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 430, 820, 1366] },
  },
} satisfies Meta<typeof AdminProfilePhotoReviewQueue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { replacements: [], currentPhotos: [] },
};
