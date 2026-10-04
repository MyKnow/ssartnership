import { revalidateTag, unstable_cache } from "next/cache";
import {
  ADMIN_PERMISSION_TEMPLATES,
  type AdminPermissionMatrix,
  type AdminPermissionTemplateKey,
  assertCanManageAdminPermissions,
  findAdminPermissionTemplate,
  normalizeAdminPermissionMatrix,
} from "@/lib/admin-permissions";
import {
  getDefaultManagedCampusSlugsForTemplate,
  normalizeAdminManagedCampusSlugs,
} from "@/lib/admin-scope";
import { getMockAdminAccountById } from "@/lib/mock/admin";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminAccount = {
  // Session and audit references use the owning members.id.
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
  managedCampusSlugs: string[];
  createdAt: string | null;
  updatedAt: string | null;
  permissions: AdminPermissionMatrix;
};

type AdminMemberRow = {
  id: string;
  mattermost_account_id: string | null;
  display_name: string | null;
  email: string | null;
  must_change_password: boolean | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AdminDirectoryRow = {
  id: string;
  mm_username: string;
  display_name: string | null;
  is_active: boolean;
};

type AdminProfileRow = {
  id: string;
  member_id: string;
  permission_template_key: string;
  managed_campus_slugs: string[] | null;
  is_active: boolean;
  permission_version: number;
  created_at: string | null;
  updated_at: string | null;
};

type AdminMemberWithDirectoryRow = AdminMemberRow & {
  directory:
    | AdminDirectoryRow
    | AdminDirectoryRow[]
    | null;
};

type AdminProfileSessionRow = AdminProfileRow & {
  member:
    | AdminMemberWithDirectoryRow
    | AdminMemberWithDirectoryRow[]
    | null;
};

type AdminSessionSnapshotRow = {
  id: string;
  login_id: string;
  display_name: string | null;
  email: string | null;
  must_change_password: boolean;
  is_active: boolean;
  permission_version: number;
  permission_template_key: string;
  managed_campus_slugs: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

const ADMIN_MEMBER_SELECT =
  "id,mattermost_account_id,display_name,email,must_change_password,deleted_at,created_at,updated_at";
const ADMIN_DIRECTORY_SELECT = "id,mm_username,display_name,is_active";
const ADMIN_PROFILE_SELECT =
  "id,member_id,permission_template_key,managed_campus_slugs,is_active,permission_version,created_at,updated_at";
const ADMIN_PROFILE_SESSION_SELECT = [
  ADMIN_PROFILE_SELECT,
  `member:members!admin_profiles_member_id_fkey(${ADMIN_MEMBER_SELECT},directory:mm_user_directory!members_mattermost_account_id_fkey(${ADMIN_DIRECTORY_SELECT}))`,
].join(",");

const SUPER_ADMIN_USERNAME = "myknow";
const DEFAULT_ADMIN_PERMISSION_ID = "readonly";
const ADMIN_ACCOUNT_CACHE_REVALIDATE_SECONDS = 5;
const ADMIN_ACCOUNTS_LIST_CACHE_REVALIDATE_SECONDS = 5;
const ADMIN_ACCOUNTS_LIST_CACHE_TAG = "admin-accounts-list";

function getAdminAccountCacheTag(memberId: string) {
  return `admin-account:${memberId}`;
}

function normalizeMemberUsername(value: string) {
  return value.trim().toLowerCase();
}

function isSuperAdminLoginId(loginId: string | null | undefined) {
  return normalizeMemberUsername(loginId ?? "") === SUPER_ADMIN_USERNAME;
}

function getTemplateOrNull(permissionId: string | null | undefined) {
  return permissionId ? findAdminPermissionTemplate(permissionId) : null;
}

function mapAdminProfile(
  profile: AdminProfileRow,
  member: AdminMemberRow,
  directory: AdminDirectoryRow,
): AdminAccount | null {
  const template = getTemplateOrNull(profile.permission_template_key);
  if (!template || !directory.mm_username) {
    return null;
  }

  return {
    id: member.id,
    loginId: directory.mm_username,
    displayName:
      member.display_name?.trim()
      || directory.display_name?.trim()
      || directory.mm_username,
    email: member.email,
    isActive: profile.is_active && !member.deleted_at && directory.is_active,
    mustChangePassword: member.must_change_password === true,
    initialSetupExpiresAt: null,
    initialSetupCompletedAt: profile.created_at ?? new Date(0).toISOString(),
    lastLoginAt: null,
    permissionVersion: profile.permission_version,
    permissionId: template.key,
    managedCampusSlugs: normalizeAdminManagedCampusSlugs(
      profile.managed_campus_slugs ?? [],
    ),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    permissions: normalizeAdminPermissionMatrix(template.permissions),
  };
}

function mapAdminSessionSnapshot(value: unknown): AdminAccount | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<AdminSessionSnapshotRow>;
  if (
    typeof snapshot.id !== "string" ||
    typeof snapshot.login_id !== "string" ||
    snapshot.login_id.length === 0 ||
    typeof snapshot.permission_template_key !== "string" ||
    typeof snapshot.permission_version !== "number" ||
    typeof snapshot.must_change_password !== "boolean" ||
    typeof snapshot.is_active !== "boolean"
  ) {
    return null;
  }

  const template = getTemplateOrNull(snapshot.permission_template_key);
  if (!template) {
    return null;
  }

  return {
    id: snapshot.id,
    loginId: snapshot.login_id,
    displayName: snapshot.display_name?.trim() || snapshot.login_id,
    email: snapshot.email ?? null,
    isActive: snapshot.is_active,
    mustChangePassword: snapshot.must_change_password,
    initialSetupExpiresAt: null,
    initialSetupCompletedAt: snapshot.created_at ?? new Date(0).toISOString(),
    lastLoginAt: null,
    permissionVersion: snapshot.permission_version,
    permissionId: template.key,
    managedCampusSlugs: normalizeAdminManagedCampusSlugs(
      snapshot.managed_campus_slugs ?? [],
    ),
    createdAt: snapshot.created_at ?? null,
    updatedAt: snapshot.updated_at ?? null,
    permissions: normalizeAdminPermissionMatrix(template.permissions),
  };
}

async function getAdminProfileByMemberId(memberId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("admin_profiles")
    .select(ADMIN_PROFILE_SELECT)
    .eq("member_id", memberId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as AdminProfileRow;
}

function resolveRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function mapAdminProfileSessionRow(
  row: AdminProfileSessionRow,
): AdminAccount | null {
  const member = resolveRelation(row.member);
  const directory = resolveRelation(member?.directory);
  return member && directory ? mapAdminProfile(row, member, directory) : null;
}

function logAdminAccountReadFailure(
  operation: string,
  error: { message: string; code?: string },
) {
  console.error("[admin-accounts] read failed", {
    operation,
    code: error.code ?? null,
    message: error.message,
  });
}

/**
 * `get_admin_session_snapshot` (20260728032722) is part of the forward-only
 * schema. A failure is logged and thrown instead of falling back to wider
 * PostgREST reads, so permission or connectivity problems are not hidden.
 * `getAdminSession()` converts the throw into "no admin session".
 */
async function getAdminAccountByIdUncached(memberId: string) {
  if (!memberId) {
    return null;
  }

  const mockAccount = getMockAdminAccountById(memberId);
  if (mockAccount) {
    return mockAccount;
  }

  const { data, error } = await getSupabaseAdminClient().rpc(
    "get_admin_session_snapshot",
    { p_member_id: memberId },
  );
  if (error) {
    logAdminAccountReadFailure("get_admin_session_snapshot", error);
    throw new Error("관리자 계정 정보를 불러오지 못했습니다.");
  }

  return mapAdminSessionSnapshot(data);
}

/**
 * The signed cookie still carries the permission version and the cached
 * snapshot is invalidated whenever this application changes an admin profile.
 * A short bounded cache avoids paying the remote Supabase round trip on every
 * API request while keeping permission changes visible within five seconds.
 */
export async function getAdminAccountById(memberId: string) {
  if (!memberId) {
    return null;
  }

  return unstable_cache(
    () => getAdminAccountByIdUncached(memberId),
    ["admin-account-by-id", memberId],
    {
      revalidate: ADMIN_ACCOUNT_CACHE_REVALIDATE_SECONDS,
      tags: [getAdminAccountCacheTag(memberId)],
    },
  )();
}

export function invalidateAdminAccountCache(memberId: string) {
  if (!memberId) {
    return;
  }

  revalidateTag(getAdminAccountCacheTag(memberId), "max");
  revalidateTag(ADMIN_ACCOUNTS_LIST_CACHE_TAG, "max");
}

export async function getAdminAccountByLoginId(loginId: string) {
  const username = normalizeMemberUsername(loginId);
  if (!username) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data: directory, error: directoryError } = await supabase
    .from("mm_user_directory")
    .select("id")
    .eq("mm_username", username)
    .eq("is_active", true)
    .maybeSingle();
  if (directoryError || !directory?.id) {
    return null;
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id")
    .eq("mattermost_account_id", directory.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (memberError || !member?.id) {
    return null;
  }

  return getAdminAccountById(member.id as string);
}

export async function authenticateAdminCredentials(
  loginId?: string,
  password?: string,
) {
  void loginId;
  void password;
  return null;
}

async function listAdminAccountsFromRelation() {
  const { data, error } = await getSupabaseAdminClient()
    .from("admin_profiles")
    .select(ADMIN_PROFILE_SESSION_SELECT)
    .order("updated_at", { ascending: false });
  if (error) {
    logAdminAccountReadFailure("admin_profiles_relation", error);
    throw new Error("관리자 계정 목록을 불러오지 못했습니다.");
  }

  return ((data ?? []) as unknown as AdminProfileSessionRow[])
    .map(mapAdminProfileSessionRow)
    .filter((account): account is AdminAccount => account !== null);
}

export async function listAdminAccounts() {
  return getCachedAdminAccounts();
}

const getCachedAdminAccounts = unstable_cache(
  listAdminAccountsFromRelation,
  [ADMIN_ACCOUNTS_LIST_CACHE_TAG],
  {
    revalidate: ADMIN_ACCOUNTS_LIST_CACHE_REVALIDATE_SECONDS,
    tags: [ADMIN_ACCOUNTS_LIST_CACHE_TAG],
  },
);

export async function countActivePrivilegedAdmins() {
  const accounts = await listAdminAccounts();
  return accounts.filter(
    (account) =>
      account.isActive &&
      account.permissions.admin_management.update &&
      account.permissions.admin_management.delete,
  ).length;
}

async function persistAdminProfile(input: {
  memberId: string;
  permissionTemplateKey: AdminPermissionTemplateKey;
  managedCampusSlugs: string[];
  isActive: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const existing = await getAdminProfileByMemberId(input.memberId);
  const nextVersion = (existing?.permission_version ?? 0) + 1;
  const payload = {
    permission_template_key: input.permissionTemplateKey,
    managed_campus_slugs: input.managedCampusSlugs,
    is_active: input.isActive,
    permission_version: nextVersion,
    updated_at: new Date().toISOString(),
  };
  const { error } = existing
    ? await supabase.from("admin_profiles").update(payload).eq("id", existing.id)
    : await supabase.from("admin_profiles").insert({
        member_id: input.memberId,
        ...payload,
      });
  if (error) {
    throw new Error("관리자 권한 프로필을 저장하지 못했습니다.");
  }
  invalidateAdminAccountCache(input.memberId);
}

export async function grantMemberAdminPermission(input: {
  memberUsername: string;
  templateKey?: string | null;
  managedCampusSlugs?: string[] | null;
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
  if (template.key === "super_admin" && !isSuperAdminLoginId(memberUsername)) {
    throw new Error("Super Admin 권한은 myknow 계정에만 부여할 수 있습니다.");
  }
  const managedCampusSlugs = getDefaultManagedCampusSlugsForTemplate(
    template.key,
    input.managedCampusSlugs,
  );
  if (template.key === "regional_partner_manager" && managedCampusSlugs.length === 0) {
    throw new Error("지역 제휴 관리자 권한에는 관리 캠퍼스를 하나 이상 선택해야 합니다.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: directory, error: directoryError } = await supabase
    .from("mm_user_directory")
    .select("id")
    .eq("mm_username", memberUsername)
    .eq("is_active", true)
    .maybeSingle();
  if (directoryError || !directory?.id) {
    throw new Error("회원을 찾을 수 없습니다.");
  }

  const { data: member, error } = await supabase
    .from("members")
    .select("id")
    .eq("mattermost_account_id", directory.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !member?.id) {
    throw new Error("회원을 찾을 수 없습니다.");
  }

  await persistAdminProfile({
    memberId: member.id as string,
    permissionTemplateKey: template.key,
    managedCampusSlugs,
    isActive: true,
  });
  const account = await getAdminAccountById(member.id as string);
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

  if (isSuperAdminLoginId(target.loginId) && !input.isActive) {
    throw new Error("myknow Super Admin 권한은 회수할 수 없습니다.");
  }

  await persistAdminProfile({
    memberId: input.targetAdminId,
    permissionTemplateKey: target.permissionId,
    managedCampusSlugs: input.isActive ? target.managedCampusSlugs : [],
    isActive: input.isActive,
  });
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
    managedCampusSlugs: target.managedCampusSlugs,
  });
}

export async function applyAdminPermissionTemplate(input: {
  actorAdminId: string;
  targetAdminId: string;
  templateKey: string;
  managedCampusSlugs?: string[] | null;
}) {
  const target = await getAdminAccountById(input.targetAdminId);
  if (!target) {
    throw new Error("관리자 권한을 가진 회원을 찾을 수 없습니다.");
  }
  const template = findAdminPermissionTemplate(input.templateKey);
  if (!template) {
    throw new Error("권한 템플릿을 찾을 수 없습니다.");
  }
  if (template.key === "super_admin" && !isSuperAdminLoginId(target.loginId)) {
    throw new Error("Super Admin 권한은 myknow 계정에만 부여할 수 있습니다.");
  }
  const managedCampusSlugs = getDefaultManagedCampusSlugsForTemplate(
    template.key,
    input.managedCampusSlugs ?? target.managedCampusSlugs,
  );
  if (template.key === "regional_partner_manager" && managedCampusSlugs.length === 0) {
    throw new Error("지역 제휴 관리자 권한에는 관리 캠퍼스를 하나 이상 선택해야 합니다.");
  }

  assertCanManageAdminPermissions({
    actorAdminId: input.actorAdminId,
    targetAdminId: input.targetAdminId,
    nextIsActive: true,
    nextPermissions: template.permissions,
    activePrivilegedAdminCount: await countActivePrivilegedAdmins(),
  });

  await persistAdminProfile({
    memberId: input.targetAdminId,
    permissionTemplateKey: template.key,
    managedCampusSlugs,
    isActive: true,
  });
}

export function listAdminPermissionTemplates() {
  return ADMIN_PERMISSION_TEMPLATES;
}
