import {
  ADMIN_PERMISSION_TEMPLATES,
  type AdminPermissionMatrix,
  type AdminPermissionTemplateKey,
  assertCanManageAdminPermissions,
  findAdminPermissionTemplate,
  normalizeAdminPermissionMatrix,
} from "@/lib/admin-permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminAccount = {
  id: string;
  loginId: string;
  displayName: string;
  email: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  initialSetupExpiresAt: string | null;
  initialSetupCompletedAt: string | null;
  lastLoginAt: string | null;
  permissionVersion: number;
  permissionId: AdminPermissionTemplateKey;
  createdAt: string | null;
  updatedAt: string | null;
  permissions: AdminPermissionMatrix;
};

export type AdminGrantableMember = {
  id: string;
  username: string;
  displayName: string;
  permissionId: string | null;
};

type AdminMemberRow = {
  id: string;
  mm_username: string | null;
  display_name: string | null;
  must_change_password: boolean | null;
  admin_permission_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

const ADMIN_MEMBER_SELECT =
  "id,mm_username,display_name,must_change_password,admin_permission_id,created_at,updated_at";

const SUPER_ADMIN_USERNAME = "myknow";
const DEFAULT_ADMIN_PERMISSION_ID = "readonly";

function normalizeMemberUsername(value: string) {
  return value.trim();
}

function resolveMemberPermissionId(row: AdminMemberRow) {
  if (row.mm_username === SUPER_ADMIN_USERNAME) {
    return "super_admin";
  }
  return row.admin_permission_id;
}

function getTemplateOrNull(permissionId: string | null | undefined) {
  if (!permissionId) {
    return null;
  }
  return findAdminPermissionTemplate(permissionId);
}

function mapAdminMember(row: AdminMemberRow): AdminAccount | null {
  const permissionId = resolveMemberPermissionId(row);
  const template = getTemplateOrNull(permissionId);
  if (!template || !row.mm_username) {
    return null;
  }

  return {
    id: row.id,
    loginId: row.mm_username,
    displayName: row.display_name?.trim() || row.mm_username,
    email: null,
    isActive: true,
    mustChangePassword: row.must_change_password === true,
    initialSetupExpiresAt: null,
    initialSetupCompletedAt: row.created_at ?? new Date(0).toISOString(),
    lastLoginAt: null,
    permissionVersion: 1,
    permissionId: template.key,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    permissions: normalizeAdminPermissionMatrix(template.permissions),
  };
}

export async function getAdminAccountById(memberId: string) {
  if (!memberId) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select(ADMIN_MEMBER_SELECT)
    .eq("id", memberId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapAdminMember(data as AdminMemberRow);
}

export async function getAdminAccountByLoginId(loginId: string) {
  const username = normalizeMemberUsername(loginId);
  if (!username) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select(ADMIN_MEMBER_SELECT)
    .eq("mm_username", username)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapAdminMember(data as AdminMemberRow);
}

export async function authenticateAdminCredentials(
  loginId?: string,
  password?: string,
) {
  void loginId;
  void password;
  return null;
}

export async function listAdminAccounts() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select(ADMIN_MEMBER_SELECT)
    .or(`admin_permission_id.not.is.null,mm_username.eq.${SUPER_ADMIN_USERNAME}`)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AdminMemberRow[])
    .map((row) => mapAdminMember(row))
    .filter((account): account is AdminAccount => account !== null);
}

export async function listAdminGrantableMembers() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("id,mm_username,display_name,admin_permission_id")
    .not("mm_username", "is", null)
    .order("display_name", { ascending: true, nullsFirst: false })
    .order("mm_username", { ascending: true })
    .limit(1000);

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AdminMemberRow[]).flatMap<AdminGrantableMember>((row) => {
    const username = row.mm_username?.trim();
    if (!username) {
      return [];
    }

    return [
      {
        id: row.id,
        username,
        displayName: row.display_name?.trim() || username,
        permissionId: resolveMemberPermissionId(row),
      },
    ];
  });
}

export async function countActivePrivilegedAdmins() {
  const accounts = await listAdminAccounts();
  return accounts.filter(
    (account) =>
      account.isActive &&
      account.permissions.admin_management.update &&
      account.permissions.admin_management.delete,
  ).length;
}

export async function grantMemberAdminPermission(input: {
  memberUsername: string;
  templateKey?: string | null;
}) {
  const memberUsername = normalizeMemberUsername(input.memberUsername);
  if (!memberUsername) {
    throw new Error("회원 아이디를 입력해 주세요.");
  }

  const templateKey = input.templateKey?.trim() || DEFAULT_ADMIN_PERMISSION_ID;
  const template = findAdminPermissionTemplate(templateKey);
  if (!template) {
    throw new Error("권한 템플릿을 찾을 수 없습니다.");
  }
  if (template.key === "super_admin" && memberUsername !== SUPER_ADMIN_USERNAME) {
    throw new Error("Super Admin 권한은 myknow 계정에만 부여할 수 있습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .update({ admin_permission_id: template.key })
    .eq("mm_username", memberUsername)
    .select(ADMIN_MEMBER_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("회원을 찾을 수 없습니다.");
  }

  const account = mapAdminMember(data as AdminMemberRow);
  if (!account) {
    throw new Error("관리자 권한 부여에 실패했습니다.");
  }
  return account;
}

export async function updateAdminAccountStatus(input: {
  actorAdminId: string;
  targetAdminId: string;
  isActive: boolean;
}) {
  const target = await getAdminAccountById(input.targetAdminId);
  if (!target) {
    throw new Error("관리자 권한을 가진 회원을 찾을 수 없습니다.");
  }

  const nextPermissions = input.isActive
    ? target.permissions
    : normalizeAdminPermissionMatrix(null);
  assertCanManageAdminPermissions({
    actorAdminId: input.actorAdminId,
    targetAdminId: input.targetAdminId,
    nextIsActive: input.isActive,
    nextPermissions,
    activePrivilegedAdminCount: await countActivePrivilegedAdmins(),
  });

  if (target.loginId === SUPER_ADMIN_USERNAME && !input.isActive) {
    throw new Error("myknow Super Admin 권한은 회수할 수 없습니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("members")
    .update({
      admin_permission_id: input.isActive
        ? target.permissionId
        : null,
    })
    .eq("id", input.targetAdminId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateAdminPermissions(input: {
  actorAdminId: string;
  targetAdminId: string;
  permissions: AdminPermissionMatrix;
}) {
  const target = await getAdminAccountById(input.targetAdminId);
  if (!target) {
    throw new Error("관리자 권한을 가진 회원을 찾을 수 없습니다.");
  }
  assertCanManageAdminPermissions({
    actorAdminId: input.actorAdminId,
    targetAdminId: input.targetAdminId,
    nextIsActive: target.isActive,
    nextPermissions: input.permissions,
    activePrivilegedAdminCount: await countActivePrivilegedAdmins(),
  });

  const template = ADMIN_PERMISSION_TEMPLATES.find(
    (candidate) =>
      JSON.stringify(normalizeAdminPermissionMatrix(candidate.permissions)) ===
      JSON.stringify(normalizeAdminPermissionMatrix(input.permissions)),
  );
  if (!template) {
    throw new Error("권한 ID 기반 관리에서는 템플릿 권한만 저장할 수 있습니다.");
  }
  await applyAdminPermissionTemplate({
    actorAdminId: input.actorAdminId,
    targetAdminId: input.targetAdminId,
    templateKey: template.key,
  });
}

export async function applyAdminPermissionTemplate(input: {
  actorAdminId: string;
  targetAdminId: string;
  templateKey: string;
}) {
  const target = await getAdminAccountById(input.targetAdminId);
  if (!target) {
    throw new Error("관리자 권한을 가진 회원을 찾을 수 없습니다.");
  }
  const template = findAdminPermissionTemplate(input.templateKey);
  if (!template) {
    throw new Error("권한 템플릿을 찾을 수 없습니다.");
  }
  if (template.key === "super_admin" && target.loginId !== SUPER_ADMIN_USERNAME) {
    throw new Error("Super Admin 권한은 myknow 계정에만 부여할 수 있습니다.");
  }

  assertCanManageAdminPermissions({
    actorAdminId: input.actorAdminId,
    targetAdminId: input.targetAdminId,
    nextIsActive: true,
    nextPermissions: template.permissions,
    activePrivilegedAdminCount: await countActivePrivilegedAdmins(),
  });

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("members")
    .update({ admin_permission_id: template.key })
    .eq("id", input.targetAdminId);

  if (error) {
    throw new Error(error.message);
  }
}

export function listAdminPermissionTemplates() {
  return ADMIN_PERMISSION_TEMPLATES;
}
