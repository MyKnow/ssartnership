export const ADMIN_PERMISSION_RESOURCES = [
  "members",
  "reviews",
  "logs",
  "brands",
  "companies",
  "notifications",
  "home_ads",
  "events",
  "cycles",
  "admin_management",
] as const;

export type AdminPermissionResource = (typeof ADMIN_PERMISSION_RESOURCES)[number];

export const ADMIN_PERMISSION_ACTIONS = [
  "create",
  "read",
  "update",
  "delete",
] as const;

export type AdminPermissionAction = (typeof ADMIN_PERMISSION_ACTIONS)[number];

export type AdminPermissionMatrix = Record<
  AdminPermissionResource,
  Record<AdminPermissionAction, boolean>
>;

export type AdminPermissionTemplateKey =
  | "super_admin"
  | "operations_manager"
  | "partner_manager"
  | "content_manager"
  | "support"
  | "readonly";

export type AdminPermissionTemplate = {
  key: AdminPermissionTemplateKey;
  name: string;
  description: string;
  permissions: AdminPermissionMatrix;
};

const RESOURCE_LABELS: Record<AdminPermissionResource, string> = {
  members: "유저",
  reviews: "리뷰",
  logs: "로그",
  brands: "브랜드",
  companies: "협력사",
  notifications: "알림",
  home_ads: "홈광고",
  events: "이벤트",
  cycles: "기수",
  admin_management: "어드민관리",
};

const ACTION_LABELS: Record<AdminPermissionAction, string> = {
  create: "생성",
  read: "조회",
  update: "수정",
  delete: "삭제",
};

const RESOURCE_SET = new Set<string>(ADMIN_PERMISSION_RESOURCES);
const ACTION_SET = new Set<string>(ADMIN_PERMISSION_ACTIONS);

export function isAdminPermissionResource(
  value: string,
): value is AdminPermissionResource {
  return RESOURCE_SET.has(value);
}

export function isAdminPermissionAction(
  value: string,
): value is AdminPermissionAction {
  return ACTION_SET.has(value);
}

export function getAdminPermissionResourceLabel(
  resource: AdminPermissionResource,
) {
  return RESOURCE_LABELS[resource];
}

export function getAdminPermissionActionLabel(action: AdminPermissionAction) {
  return ACTION_LABELS[action];
}

export function createEmptyAdminPermissionMatrix(): AdminPermissionMatrix {
  return Object.fromEntries(
    ADMIN_PERMISSION_RESOURCES.map((resource) => [
      resource,
      Object.fromEntries(
        ADMIN_PERMISSION_ACTIONS.map((action) => [action, false]),
      ),
    ]),
  ) as AdminPermissionMatrix;
}

function grant(
  resources: AdminPermissionResource[],
  actions: AdminPermissionAction[] = [...ADMIN_PERMISSION_ACTIONS],
) {
  const matrix = createEmptyAdminPermissionMatrix();
  for (const resource of resources) {
    for (const action of actions) {
      matrix[resource][action] = true;
    }
  }
  return normalizeAdminPermissionMatrix(matrix);
}

export function normalizeAdminPermissionMatrix(
  input?: Partial<
    Record<
      AdminPermissionResource | string,
      Partial<Record<AdminPermissionAction | string, boolean>>
    >
  > | null,
): AdminPermissionMatrix {
  const matrix = createEmptyAdminPermissionMatrix();
  for (const resource of ADMIN_PERMISSION_RESOURCES) {
    const resourceInput = input?.[resource];
    if (!resourceInput) {
      continue;
    }
    for (const action of ADMIN_PERMISSION_ACTIONS) {
      matrix[resource][action] = resourceInput[action] === true;
    }
  }

  matrix.logs.create = false;
  matrix.logs.update = false;
  matrix.logs.delete = false;

  return matrix;
}

export function canAdmin(
  matrix: AdminPermissionMatrix | null | undefined,
  resource: AdminPermissionResource,
  action: AdminPermissionAction,
) {
  if (!matrix) {
    return false;
  }
  return normalizeAdminPermissionMatrix(matrix)[resource][action] === true;
}

export function isPrivilegedAdminPermissionMatrix(
  matrix: AdminPermissionMatrix | null | undefined,
) {
  return (
    canAdmin(matrix, "admin_management", "update") &&
    canAdmin(matrix, "admin_management", "delete")
  );
}

export const ADMIN_PERMISSION_TEMPLATES: AdminPermissionTemplate[] = [
  {
    key: "super_admin",
    name: "Super Admin",
    description: "멤버 관리자 권한과 전체 운영 권한을 관리합니다.",
    permissions: grant([...ADMIN_PERMISSION_RESOURCES]),
  },
  {
    key: "operations_manager",
    name: "운영 관리자",
    description: "회원, 협력사, 알림, 이벤트, 기수 운영을 담당합니다.",
    permissions: normalizeAdminPermissionMatrix({
      members: { create: true, read: true, update: true, delete: true },
      reviews: { read: true, update: true, delete: true },
      logs: { read: true },
      brands: { create: true, read: true, update: true, delete: true },
      companies: { create: true, read: true, update: true, delete: true },
      notifications: { create: true, read: true, update: true, delete: true },
      home_ads: { create: true, read: true, update: true, delete: true },
      events: { create: true, read: true, update: true, delete: true },
      cycles: { read: true, update: true },
    }),
  },
  {
    key: "partner_manager",
    name: "업체 관리 어드민",
    description: "지역대표가 협력사와 브랜드 정보를 관리합니다.",
    permissions: normalizeAdminPermissionMatrix({
      brands: { create: true, read: true, update: true, delete: true },
      companies: { create: true, read: true, update: true, delete: true },
    }),
  },
  {
    key: "content_manager",
    name: "콘텐츠 관리자",
    description: "브랜드, 홈광고, 이벤트 노출 콘텐츠를 관리합니다.",
    permissions: normalizeAdminPermissionMatrix({
      reviews: { read: true, update: true },
      logs: { read: true },
      brands: { create: true, read: true, update: true, delete: true },
      home_ads: { create: true, read: true, update: true, delete: true },
      events: { create: true, read: true, update: true, delete: true },
    }),
  },
  {
    key: "support",
    name: "고객지원",
    description: "회원과 리뷰 상태를 확인하고 필요한 조치를 수행합니다.",
    permissions: normalizeAdminPermissionMatrix({
      members: { read: true, update: true },
      reviews: { read: true, update: true },
      logs: { read: true },
      brands: { read: true },
      companies: { read: true },
      notifications: { read: true },
      events: { read: true },
    }),
  },
  {
    key: "readonly",
    name: "조회 전용",
    description: "운영 데이터를 조회만 할 수 있습니다.",
    permissions: grant([...ADMIN_PERMISSION_RESOURCES], ["read"]),
  },
];

export function findAdminPermissionTemplate(key: string) {
  return ADMIN_PERMISSION_TEMPLATES.find((template) => template.key === key) ?? null;
}

export function matrixToPermissionRows(
  adminId: string,
  matrix: AdminPermissionMatrix,
) {
  const normalized = normalizeAdminPermissionMatrix(matrix);
  return ADMIN_PERMISSION_RESOURCES.flatMap((resource) =>
    ADMIN_PERMISSION_ACTIONS.map((action) => ({
      admin_id: adminId,
      resource,
      action,
      granted: normalized[resource][action],
    })),
  );
}

export function permissionRowsToMatrix(
  rows: Array<{
    resource?: string | null;
    action?: string | null;
    granted?: boolean | null;
  }>,
) {
  const matrix = createEmptyAdminPermissionMatrix();
  for (const row of rows) {
    if (
      row.resource &&
      row.action &&
      isAdminPermissionResource(row.resource) &&
      isAdminPermissionAction(row.action)
    ) {
      matrix[row.resource][row.action] = row.granted === true;
    }
  }
  return normalizeAdminPermissionMatrix(matrix);
}

export function parseAdminPermissionMatrixFormData(formData: FormData) {
  const matrix = createEmptyAdminPermissionMatrix();
  for (const resource of ADMIN_PERMISSION_RESOURCES) {
    for (const action of ADMIN_PERMISSION_ACTIONS) {
      matrix[resource][action] =
        formData.get(`permission:${resource}:${action}`) === "on";
    }
  }
  return normalizeAdminPermissionMatrix(matrix);
}

export function assertCanManageAdminPermissions(input: {
  actorAdminId: string;
  targetAdminId: string;
  nextIsActive: boolean;
  nextPermissions: AdminPermissionMatrix;
  activePrivilegedAdminCount: number;
}) {
  const nextIsPrivileged =
    input.nextIsActive &&
    isPrivilegedAdminPermissionMatrix(input.nextPermissions);

  if (
    input.activePrivilegedAdminCount <= 1 &&
    input.actorAdminId === input.targetAdminId &&
    !nextIsPrivileged
  ) {
    throw new Error("마지막 최고 권한 관리자는 비활성화하거나 권한을 제거할 수 없습니다.");
  }

  if (
    input.actorAdminId === input.targetAdminId &&
    !canAdmin(input.nextPermissions, "admin_management", "update")
  ) {
    throw new Error("자기 자신의 관리자 권한 수정 권한은 제거할 수 없습니다.");
  }
}
