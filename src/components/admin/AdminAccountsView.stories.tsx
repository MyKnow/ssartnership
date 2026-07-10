import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ADMIN_PERMISSION_TEMPLATES } from "@/lib/admin-permissions";
import AdminAccountsView from "./AdminAccountsView";

const regionalTemplate = ADMIN_PERMISSION_TEMPLATES.find(
  (template) => template.key === "regional_partner_manager",
)!;

const meta = {
  title: "Domains/Admin/AdminAccountsView",
  component: AdminAccountsView,
  args: {
    accounts: [
      {
        id: "admin-seoul-partner",
        loginId: "seoul_partner_admin",
        displayName: "서울 제휴 운영 담당자",
        email: null,
        isActive: true,
        mustChangePassword: false,
        initialSetupExpiresAt: null,
        initialSetupCompletedAt: null,
        lastLoginAt: "2026-07-10T09:30:00+09:00",
        permissionVersion: 1,
        permissionId: "regional_partner_manager",
        managedCampusSlugs: ["seoul"],
        createdAt: "2026-05-01T10:00:00+09:00",
        updatedAt: "2026-07-10T09:30:00+09:00",
        permissions: regionalTemplate.permissions,
      },
    ],
    templates: ADMIN_PERMISSION_TEMPLATES,
    feedback: null,
    grantAction: async () => {},
    applyTemplateAction: async () => {},
    updateStatusAction: async () => {},
  },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminAccountsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
