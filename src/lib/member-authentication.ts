import {
  classifyMemberLoginIdentifier,
  type MemberLoginIdentifier,
} from "@/lib/member-domain";
import {
  findMmUserDirectoryEntryByUsername,
  upsertMmUserDirectorySnapshot,
} from "@/lib/mm-directory";
import { resolveSelectableMemberByUsername } from "@/lib/ssafy-verify/directory";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type LoginMember = {
  id: string;
  password_hash: string | null;
  password_salt: string | null;
  must_change_password: boolean | null;
};

export type LoginMemberAuthenticationMethod = "email" | "manual" | "mattermost";

export type LoginMemberResolution = {
  member: LoginMember;
  authenticationMethod: LoginMemberAuthenticationMethod;
};

const MEMBER_LOGIN_SELECT = "id,password_hash,password_salt,must_change_password";

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

async function resolveMemberByMattermostUsername(username: string) {
  const directoryEntry = await findMmUserDirectoryEntryByUsername(username);
  if (directoryEntry?.id) {
    return findActiveMemberByMattermostDirectoryId(directoryEntry.id);
  }

  const resolved = await resolveSelectableMemberByUsername(username);
  if (!resolved) {
    return null;
  }
  if (resolved.directorySnapshot) {
    await upsertMmUserDirectorySnapshot(resolved.directorySnapshot);
  }

  const refreshedDirectory = await findMmUserDirectoryEntryByUsername(username);
  if (refreshedDirectory?.id) {
    return findActiveMemberByMattermostDirectoryId(refreshedDirectory.id);
  }
  return null;
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
