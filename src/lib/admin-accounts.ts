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
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminAccount = {
  // During expand/contract this remains the members.id so existing sessions and
  // audit references remain valid. admin_profiles.id becomes the actor ID in
  // the later contract migration.
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
  mm_username: string | null;
  display_name: string | null;
  email: string | null;
  must_change_password: boolean | null;
  deleted_at: string | null;
  // Legacy compatibility fields are read only while migration backfill rolls
  // out. New writes always target admin_profiles first.
  admin_permission_id?: string | null;
  admin_managed_campus_slugs?: string[] | null;
  created_at: string | null;
  updated_at: string | null;
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

const ADMIN_MEMBER_SELECT =
  "id,mm_username,display_name,email,must_change_password,deleted_at,admin_permission_id,admin_managed_campus_slugs,created_at,updated_at";
const ADMIN_PROFILE_SELECT =
  "id,member_id,permission_template_key,managed_campus_slugs,is_active,permission_version,created_at,updated_at";

const SUPER_ADMIN_USERNAME = "myknow";
const DEFAULT_ADMIN_PERMISSION_ID = "readonly";

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
): AdminAccount | null {
  const template = getTemplateOrNull(profile.permission_template_key);
  if (!template || !member.mm_username) {
    return null;
  }

  return {
    id: member.id,
    loginId: member.mm_username,
    displayName: member.display_name?.trim() || member.mm_username,
    email: member.email,
    isActive: profile.is_active && !member.deleted_at,
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

function mapLegacyAdminMember(member: AdminMemberRow): AdminAccount | null {
  const permissionId = isSuperAdminLoginId(member.mm_username)
    ? "super_admin"
    : member.admin_permission_id;
  const template = getTemplateOrNull(permissionId);
  if (!template || !member.mm_username) {
    return null;
  }

  return {
    id: member.id,
    loginId: member.mm_username,
    displayName: member.display_name?.trim() || member.mm_username,
    email: member.email,
    isActive: !member.deleted_at,
    mustChangePassword: member.must_change_password === true,
    initialSetupExpiresAt: null,
    initialSetupCompletedAt: member.created_at ?? new Date(0).toISOString(),
    lastLoginAt: null,
    permissionVersion: 1,
    permissionId: template.key,
    managedCampusSlugs: normalizeAdminManagedCampusSlugs(
      member.admin_managed_campus_slugs ?? [],
    ),
    createdAt: member.created_at,
    updatedAt: member.updated_at,
    permissions: normalizeAdminPermissionMatrix(template.permissions),
  };
}

async function getMemberById(memberId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("members")
    .select(ADMIN_MEMBER_SELECT)
    .eq("id", memberId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data as AdminMemberRow;
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

async function getAdminAccountFromProfile(memberId: string) {
  const [profile, member] = await Promise.all([
    getAdminProfileByMemberId(memberId),
    getMemberById(memberId),
  ]);
  if (!profile || !member) {
    return null;
  }
  return mapAdminProfile(profile, member);
}

export async function getAdminAccountById(memberId: string) {
  if (!memberId) {
    return null;
  }

  const account = await getAdminAccountFromProfile(memberId);
  if (account) {
    return account;
  }

  // The fallback is intentionally temporary: it protects sessions created
  // before the one-time backfill has reached a Preview environment.
  const member = await getMemberById(memberId);
  return member ? mapLegacyAdminMember(member) : null;
}

export async function getAdminAccountByLoginId(loginId: string) {
  const username = normalizeMemberUsername(loginId);
  if (!username) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("id")
    .eq("mm_username", username)
    .maybeSingle();
  if (error || !data?.id) {
    return null;
  }

  return getAdminAccountById(data.id as string);
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
  const { data: profiles, error: profileError } = await supabase
    .from("admin_profiles")
    .select(ADMIN_PROFILE_SELECT)
    .order("updated_at", { ascending: false });
  if (profileError) {
    throw new Error("관리자 프로필을 불러오지 못했습니다.");
  }

  const normalizedProfiles = (profiles ?? []) as AdminProfileRow[];
  if (normalizedProfiles.length === 0) {
    const { data: legacyMembers, error: legacyError } = await supabase
      .from("members")
      .select(ADMIN_MEMBER_SELECT)
      .or(`admin_permission_id.not.is.null,mm_username.eq.${SUPER_ADMIN_USERNAME}`)
      .order("updated_at", { ascending: false });
    if (legacyError) {
      throw new Error("관리자 계정을 불러오지 못했습니다.");
    }
    return ((legacyMembers ?? []) as AdminMemberRow[])
      .map(mapLegacyAdminMember)
      .filter((account): account is AdminAccount => account !== null);
  }

  const memberIds = normalizedProfiles.map((profile) => profile.member_id);
  const { data: members, error: memberError } = await supabase
    .from("members")
    .select(ADMIN_MEMBER_SELECT)
    .in("id", memberIds);
  if (memberError) {
    throw new Error("관리자 회원 정보를 불러오지 못했습니다.");
  }

  const memberById = new Map(
    ((members ?? []) as AdminMemberRow[]).map((member) => [member.id, member]),
  );
  return normalizedProfiles
    .map((profile) => {
      const member = memberById.get(profile.member_id);
      return member ? mapAdminProfile(profile, member) : null;
    })
    .filter((account): account is AdminAccount => account !== null);
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

  // Dual-write only for old readers that have not yet moved to admin_profiles.
  const { error: legacyError } = await supabase
    .from("members")
    .update({
      admin_permission_id: input.isActive ? input.permissionTemplateKey : null,
      admin_managed_campus_slugs: input.isActive
        ? input.managedCampusSlugs
        : [],
    })
    .eq("id", input.memberId);
  if (legacyError) {
    throw new Error("기존 관리자 권한 호환 정보를 저장하지 못했습니다.");
  }
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
  const { data: member, error } = await supabase
    .from("members")
    .select("id")
    .eq("mm_username", memberUsername)
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
