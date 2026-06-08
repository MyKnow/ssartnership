import { SITE_URL } from "@/lib/site";
import {
  ADMIN_PERMISSION_TEMPLATES,
  type AdminPermissionMatrix,
  assertCanManageAdminPermissions,
  findAdminPermissionTemplate,
  matrixToPermissionRows,
  normalizeAdminPermissionMatrix,
  permissionRowsToMatrix,
} from "@/lib/admin-permissions";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  isValidPassword,
  verifyPassword,
} from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  normalizeAdminIdentifier,
  validateAdminIdentifier,
  validateAdminPasswordInput,
} from "@/lib/validation";

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
  createdAt: string | null;
  updatedAt: string | null;
  permissions: AdminPermissionMatrix;
};

type AdminAccountRow = {
  id: string;
  login_id: string;
  display_name: string;
  email: string | null;
  password_hash?: string | null;
  password_salt?: string | null;
  is_active: boolean;
  must_change_password: boolean;
  initial_setup_expires_at: string | null;
  initial_setup_completed_at: string | null;
  last_login_at: string | null;
  permission_version: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type AdminPermissionRow = {
  resource: string | null;
  action: string | null;
  granted: boolean | null;
};

const ADMIN_ACCOUNT_SELECT =
  "id,login_id,display_name,email,password_hash,password_salt,is_active,must_change_password,initial_setup_expires_at,initial_setup_completed_at,last_login_at,permission_version,created_at,updated_at";

function mapAdminAccount(
  row: AdminAccountRow,
  permissions: AdminPermissionRow[] = [],
): AdminAccount {
  return {
    id: row.id,
    loginId: row.login_id,
    displayName: row.display_name,
    email: row.email ?? null,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    initialSetupExpiresAt: row.initial_setup_expires_at ?? null,
    initialSetupCompletedAt: row.initial_setup_completed_at ?? null,
    lastLoginAt: row.last_login_at ?? null,
    permissionVersion: row.permission_version ?? 1,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    permissions: permissionRowsToMatrix(permissions),
  };
}

export function buildAdminInitialSetupUrl(token: string, host?: string | null) {
  const base = host?.trim() || SITE_URL;
  return new URL(`/admin/setup/${encodeURIComponent(token)}`, base).toString();
}

async function getAdminPermissionRows(adminIds: string[]) {
  if (adminIds.length === 0) {
    return new Map<string, AdminPermissionRow[]>();
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_permissions")
    .select("admin_id,resource,action,granted")
    .in("admin_id", adminIds);

  if (error) {
    throw new Error(error.message);
  }

  const rowsByAdminId = new Map<string, AdminPermissionRow[]>();
  for (const row of data ?? []) {
    const adminId = String(row.admin_id);
    const rows = rowsByAdminId.get(adminId) ?? [];
    rows.push({
      resource: row.resource ?? null,
      action: row.action ?? null,
      granted: row.granted ?? null,
    });
    rowsByAdminId.set(adminId, rows);
  }
  return rowsByAdminId;
}

export async function getAdminAccountById(adminId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_accounts")
    .select(ADMIN_ACCOUNT_SELECT)
    .eq("id", adminId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const rowsByAdminId = await getAdminPermissionRows([data.id]);
  return mapAdminAccount(data as AdminAccountRow, rowsByAdminId.get(data.id) ?? []);
}

export async function getAdminAccountByLoginId(loginId: string) {
  const normalized = normalizeAdminIdentifier(loginId);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_accounts")
    .select(ADMIN_ACCOUNT_SELECT)
    .eq("login_id", normalized)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const rowsByAdminId = await getAdminPermissionRows([data.id]);
  return mapAdminAccount(data as AdminAccountRow, rowsByAdminId.get(data.id) ?? []);
}

export async function authenticateAdminCredentials(
  loginId: string,
  password: string,
) {
  if (validateAdminIdentifier(loginId) || validateAdminPasswordInput(password)) {
    return null;
  }

  const normalized = normalizeAdminIdentifier(loginId);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_accounts")
    .select(ADMIN_ACCOUNT_SELECT)
    .eq("login_id", normalized)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as AdminAccountRow;
  if (
    !row.is_active ||
    !row.password_hash ||
    !row.password_salt ||
    row.initial_setup_completed_at === null ||
    !verifyPassword(password, row.password_salt, row.password_hash)
  ) {
    return null;
  }

  await supabase
    .from("admin_accounts")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", row.id);

  const rowsByAdminId = await getAdminPermissionRows([row.id]);
  return mapAdminAccount(row, rowsByAdminId.get(row.id) ?? []);
}

export async function listAdminAccounts() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_accounts")
    .select(ADMIN_ACCOUNT_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as AdminAccountRow[];
  const rowsByAdminId = await getAdminPermissionRows(rows.map((row) => row.id));
  return rows.map((row) => mapAdminAccount(row, rowsByAdminId.get(row.id) ?? []));
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

async function replaceAdminPermissions(
  adminId: string,
  permissions: AdminPermissionMatrix,
) {
  const supabase = getSupabaseAdminClient();
  const rows = matrixToPermissionRows(adminId, permissions);
  const { error } = await supabase.from("admin_permissions").upsert(rows, {
    onConflict: "admin_id,resource,action",
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createAdminAccount(input: {
  loginId: string;
  displayName: string;
  email?: string | null;
  templateKey?: string | null;
  permissions?: AdminPermissionMatrix | null;
}) {
  const loginId = normalizeAdminIdentifier(input.loginId);
  const idError = validateAdminIdentifier(loginId);
  if (idError) {
    throw new Error(idError);
  }

  const template = input.templateKey
    ? findAdminPermissionTemplate(input.templateKey)
    : findAdminPermissionTemplate("readonly");
  const permissions = normalizeAdminPermissionMatrix(
    input.permissions ?? template?.permissions,
  );
  const setup = issueAdminSetupTokenValues();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_accounts")
    .insert({
      login_id: loginId,
      display_name: input.displayName.trim() || loginId,
      email: input.email?.trim() || null,
      must_change_password: true,
      is_active: true,
      initial_setup_token_hash: setup.tokenHash,
      initial_setup_expires_at: setup.expiresAt,
    })
    .select(ADMIN_ACCOUNT_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await replaceAdminPermissions(data.id, permissions);
  return {
    account: mapAdminAccount(data as AdminAccountRow, matrixToPermissionRows(data.id, permissions)),
    setupToken: setup.token,
    setupUrl: buildAdminInitialSetupUrl(setup.token),
  };
}

function issueAdminSetupTokenValues() {
  const token = generateOpaqueToken(32);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  return {
    token,
    tokenHash: hashOpaqueToken(token),
    expiresAt,
  };
}

export async function issueAdminInitialSetupLink(adminId: string) {
  const setup = issueAdminSetupTokenValues();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_accounts")
    .update({
      initial_setup_token_hash: setup.tokenHash,
      initial_setup_expires_at: setup.expiresAt,
      must_change_password: true,
    })
    .eq("id", adminId)
    .select(ADMIN_ACCOUNT_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    account: mapAdminAccount(data as AdminAccountRow),
    setupToken: setup.token,
    setupUrl: buildAdminInitialSetupUrl(setup.token),
  };
}

export async function getAdminInitialSetupAccount(token: string) {
  const tokenHash = hashOpaqueToken(token);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_accounts")
    .select(ADMIN_ACCOUNT_SELECT)
    .eq("initial_setup_token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as AdminAccountRow;
  if (
    !row.is_active ||
    !row.initial_setup_expires_at ||
    new Date(row.initial_setup_expires_at).getTime() < Date.now()
  ) {
    return null;
  }

  return mapAdminAccount(row);
}

export async function completeAdminInitialSetup(input: {
  token: string;
  password: string;
  passwordConfirm: string;
}) {
  if (input.password !== input.passwordConfirm) {
    throw new Error("비밀번호 확인이 일치하지 않습니다.");
  }
  if (!isValidPassword(input.password)) {
    throw new Error("비밀번호는 8~64자, 영문/숫자/특수문자를 모두 포함해야 합니다.");
  }
  const account = await getAdminInitialSetupAccount(input.token);
  if (!account) {
    throw new Error("초기 설정 링크가 만료되었거나 유효하지 않습니다.");
  }
  const passwordRecord = hashPassword(input.password);
  const completedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("admin_accounts")
    .update({
      password_hash: passwordRecord.hash,
      password_salt: passwordRecord.salt,
      must_change_password: false,
      initial_setup_token_hash: null,
      initial_setup_expires_at: null,
      initial_setup_completed_at: completedAt,
    })
    .eq("id", account.id);

  if (error) {
    throw new Error(error.message);
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
    throw new Error("관리자 계정을 찾을 수 없습니다.");
  }
  assertCanManageAdminPermissions({
    actorAdminId: input.actorAdminId,
    targetAdminId: input.targetAdminId,
    nextIsActive: input.isActive,
    nextPermissions: target.permissions,
    activePrivilegedAdminCount: await countActivePrivilegedAdmins(),
  });

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("admin_accounts")
    .update({ is_active: input.isActive })
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
    throw new Error("관리자 계정을 찾을 수 없습니다.");
  }
  const permissions = normalizeAdminPermissionMatrix(input.permissions);
  assertCanManageAdminPermissions({
    actorAdminId: input.actorAdminId,
    targetAdminId: input.targetAdminId,
    nextIsActive: target.isActive,
    nextPermissions: permissions,
    activePrivilegedAdminCount: await countActivePrivilegedAdmins(),
  });
  await replaceAdminPermissions(input.targetAdminId, permissions);
}

export async function applyAdminPermissionTemplate(input: {
  actorAdminId: string;
  targetAdminId: string;
  templateKey: string;
}) {
  const template = findAdminPermissionTemplate(input.templateKey);
  if (!template) {
    throw new Error("권한 템플릿을 찾을 수 없습니다.");
  }
  await updateAdminPermissions({
    actorAdminId: input.actorAdminId,
    targetAdminId: input.targetAdminId,
    permissions: template.permissions,
  });
}

export function listAdminPermissionTemplates() {
  return ADMIN_PERMISSION_TEMPLATES;
}
