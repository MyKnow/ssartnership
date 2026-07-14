import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminMemberDirectCreatePanel from "./AdminMemberDirectCreatePanel";
import {
  DIRECT_MEMBER_CREATE_INITIAL_STATE,
  validateDirectMemberCreateInput,
} from "@/lib/member-direct-create";

const meta = {
  title: "Domains/Admin/AdminMemberDirectCreatePanel",
  component: AdminMemberDirectCreatePanel,
  args: {
    action: async (_previousState, formData) => {
      const validation = validateDirectMemberCreateInput({
        loginId: formData.get("loginId"),
        displayName: formData.get("displayName"),
        generation: formData.get("generation"),
        campus: formData.get("campus"),
        temporaryPassword: formData.get("temporaryPassword"),
        temporaryPasswordConfirmation: formData.get("temporaryPasswordConfirmation"),
      });
      if (!validation.ok) {
        return {
          ...DIRECT_MEMBER_CREATE_INITIAL_STATE,
          status: "error" as const,
          message: "입력값을 확인해 주세요.",
          fieldErrors: validation.fieldErrors,
        };
      }
      return {
        ...DIRECT_MEMBER_CREATE_INITIAL_STATE,
        status: "success" as const,
        message: "직접 회원 계정을 생성했습니다.",
        member: {
          id: "member-manual-seoul-001",
          manualLoginId: validation.value.manualLoginId,
          displayName: validation.value.displayName,
        },
      };
    },
  },
  parameters: {
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberDirectCreatePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
