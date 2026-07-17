import {
  classifyMemberLoginIdentifier,
  type MemberLoginIdentifier,
} from "@/lib/member-domain";
import {
  findMmUserDirectoryEntryByUsername,
} from "@/lib/mm-directory";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type LoginMember = {
  id: string;
  password_hash: string | null;
  password_salt: string | null;
  must_change_password: boolean | null;
};

export type MemberEmailRecoveryMember = LoginMember & {
  auth_session_version: number;
};

export type LoginMemberAuthenticationMethod = "email" | "manual" | "mattermost";

export type LoginMemberResolution = {
  member: LoginMember;
  authenticationMethod: LoginMemberAuthenticationMethod;
};

const MEMBER_LOGIN_SELECT = "id,password_hash,password_salt,must_change_password";
const MEMBER_EMAIL_RECOVERY_SELECT = `${MEMBER_LOGIN_SELECT},auth_session_version`;

async function findActiveMemberByMattermostDirectoryId(directoryId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("members")
    .select(MEMBER_LOGIN_SELECT)
    .eq("mattermost_account_id", directoryId)
    .is("mattermost_login_disabled_at", null)
    .is("deleted_at", null)
    .maybeSingle();
  return (data ?? null) as LoginMember | null;
}

async function findRecoverableMemberByMattermostDirectoryId(directoryId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("members")
    .select(MEMBER_EMAIL_RECOVERY_SELECT)
    .eq("mattermost_account_id", directoryId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data ?? null) as MemberEmailRecoveryMember | null;
}

async function resolveMemberByMattermostUsername(username: string) {
  const directoryEntry = await findMmUserDirectoryEntryByUsername(username);
  if (directoryEntry?.id) {
    return findActiveMemberByMattermostDirectoryId(directoryEntry.id);
  }

  return null;
}

async function resolveRecoverableMemberByMattermostUsername(username: string) {
  const directoryEntry = await findMmUserDirectoryEntryByUsername(username);
  return directoryEntry?.id
    ? findRecoverableMemberByMattermostDirectoryId(directoryEntry.id)
    : null;
}

async function resolveMemberByVerifiedEmail(email: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("members")
    .select(MEMBER_LOGIN_SELECT)
    .eq("email_normalized", email)
    .not("email_verified_at", "is", null)
    .is("deleted_at", null)
    .maybeSingle();
  return (data ?? null) as LoginMember | null;
}

async function resolveRecoverableMemberByEmail(email: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("members")
    .select(MEMBER_EMAIL_RECOVERY_SELECT)
    .eq("email_normalized", email)
    .is("deleted_at", null)
    .maybeSingle();
  return (data ?? null) as MemberEmailRecoveryMember | null;
}

async function resolveMemberByManualLoginId(manualLoginId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("members")
    .select(MEMBER_LOGIN_SELECT)
    .eq("manual_login_id", manualLoginId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data ?? null) as LoginMember | null;
}

async function resolveRecoverableMemberByManualLoginId(manualLoginId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("members")
    .select(MEMBER_EMAIL_RECOVERY_SELECT)
    .eq("manual_login_id", manualLoginId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data ?? null) as MemberEmailRecoveryMember | null;
}

export async function resolveActiveMemberForLogin(identifier: MemberLoginIdentifier) {
  const resolved = await resolveActiveMemberForLoginWithSource(identifier);
  return resolved?.member ?? null;
}

/**
 * Resolves the account and the credential source independently. A value with
 * the direct-member prefix can fall back to a legacy MM username, so callers
 * must issue the session for the source that actually matched.
 */
export async function resolveActiveMemberForLoginWithSource(
  identifier: MemberLoginIdentifier,
): Promise<LoginMemberResolution | null> {
  if (identifier.kind === "email") {
    const member = await resolveMemberByVerifiedEmail(identifier.value);
    return member ? { member, authenticationMethod: "email" } : null;
  }
  if (identifier.kind === "manual_login_id") {
    const manualMember = await resolveMemberByManualLoginId(identifier.value);
    if (manualMember) {
      return { member: manualMember, authenticationMethod: "manual" };
    }
    const mattermostMember = await resolveMemberByMattermostUsername(identifier.value);
    return mattermostMember
      ? { member: mattermostMember, authenticationMethod: "mattermost" }
      : null;
  }
  const member = await resolveMemberByMattermostUsername(identifier.value);
  return member ? { member, authenticationMethod: "mattermost" } : null;
}

export async function resolveActiveMemberForLoginInput(value: unknown) {
  const identifier = classifyMemberLoginIdentifier(value);
  if (!identifier) {
    return { identifier: null, member: null } as const;
  }
  return {
    identifier,
    member: await resolveActiveMemberForLogin(identifier),
  } as const;
}

/**
 * This resolver deliberately ignores the Mattermost-login-disabled flag. A
 * member who can still prove the pre-existing local password may create an
 * email credential during a Mattermost outage, but cannot use this path to
 * obtain a normal user session before email verification succeeds.
 */
export async function resolveMemberForEmailRecovery(value: unknown) {
  const identifier = classifyMemberLoginIdentifier(value);
  if (!identifier) return null;

  if (identifier.kind === "email") {
    return resolveRecoverableMemberByEmail(identifier.value);
  }
  if (identifier.kind === "manual_login_id") {
    return (await resolveRecoverableMemberByManualLoginId(identifier.value))
      ?? resolveRecoverableMemberByMattermostUsername(identifier.value);
  }
  return resolveRecoverableMemberByMattermostUsername(identifier.value);
}
