import {
  ADMIN_PERMISSION_TEMPLATES,
  type AdminPermissionMatrix,
} from "@/lib/admin-permissions";
import type { AdminAccount } from "@/lib/admin-accounts";
import { MOCK_MEMBER_ID } from "@/lib/mock/member";

type MockAdminAuthEnvironment = {
  NODE_ENV?: string;
  NEXT_PUBLIC_DATA_SOURCE?: string;
  E2E_ADMIN_AUTH?: string;
  E2E_MOCK_MUTATIONS?: string;
};

const E2E_ADMIN_LOGIN_ID = "e2e-admin";
const E2E_ADMIN_PERMISSION_ID = "super_admin";
const E2E_ADMIN_CREATED_AT = "2000-01-01T00:00:00.000Z";

export function isMockAdminAuthEnabled(
  environment: MockAdminAuthEnvironment = process.env,
) {
  return (
    environment.NODE_ENV !== "production" &&
    environment.NEXT_PUBLIC_DATA_SOURCE === "mock" &&
    environment.E2E_ADMIN_AUTH === "1" &&
    environment.E2E_MOCK_MUTATIONS === "1"
  );
}

function getSyntheticPermissions(): AdminPermissionMatrix {
  const template = ADMIN_PERMISSION_TEMPLATES.find(
    (candidate) => candidate.key === E2E_ADMIN_PERMISSION_ID,
  );
  if (!template) {
    throw new Error("E2E 관리자 권한 템플릿을 찾을 수 없습니다.");
  }
  return structuredClone(template.permissions);
}

function createMockAdminAccount(): AdminAccount {
  return {
    id: MOCK_MEMBER_ID,
    loginId: E2E_ADMIN_LOGIN_ID,
    displayName: "E2E 관리자",
    email: "e2e-admin@example.test",
    isActive: true,
    mustChangePassword: false,
    initialSetupExpiresAt: null,
    initialSetupCompletedAt: E2E_ADMIN_CREATED_AT,
    lastLoginAt: null,
    permissionVersion: 1,
    permissionId: E2E_ADMIN_PERMISSION_ID,
    managedCampusSlugs: [],
    createdAt: E2E_ADMIN_CREATED_AT,
    updatedAt: E2E_ADMIN_CREATED_AT,
    permissions: getSyntheticPermissions(),
  };
}

export function getMockAdminAccountById(
  memberId: string,
  environment: MockAdminAuthEnvironment = process.env,
) {
  if (!isMockAdminAuthEnabled(environment) || memberId !== MOCK_MEMBER_ID) {
    return null;
  }
  return createMockAdminAccount();
}
