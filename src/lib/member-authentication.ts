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

const MEMBER_LOGIN_SELECT = "id,password_hash,password_salt,must_change_password";

async function findActiveMemberById(memberId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("members")
    .select(MEMBER_LOGIN_SELECT)
    .eq("id", memberId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data ?? null) as LoginMember | null;
}

async function findActiveMemberByMattermostDirectoryId(directoryId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("members")
    .select(MEMBER_LOGIN_SELECT)
    .eq("mattermost_account_id", directoryId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data ?? null) as LoginMember | null;
}

async function findActiveMemberByLegacyMattermostUserId(mmUserId: string) {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from("members")
    .select(MEMBER_LOGIN_SELECT)
    .eq("mm_user_id", mmUserId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data ?? null) as LoginMember | null;
}

async function resolveMemberByMattermostUsername(username: string) {
  const directoryEntry = await findMmUserDirectoryEntryByUsername(username);
  if (directoryEntry?.id) {
    const member = await findActiveMemberByMattermostDirectoryId(directoryEntry.id);
    if (member) {
      return member;
    }
    return findActiveMemberByLegacyMattermostUserId(directoryEntry.mm_user_id);
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
    const member = await findActiveMemberByMattermostDirectoryId(refreshedDirectory.id);
    if (member) {
      return member;
    }
  }
  return findActiveMemberByLegacyMattermostUserId(resolved.user.id);
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
  if (data) {
    return data as LoginMember;
  }

  // Compatibility path while graduate email identities remain during the
  // expand/contract rollout. It is removed with member_auth_identities.
  const { data: identity } = await supabase
    .from("member_auth_identities")
    .select("member_id,verified_at")
    .eq("provider", "graduate_email")
    .eq("identifier_normalized", email)
    .not("verified_at", "is", null)
    .maybeSingle();
  if (!identity?.member_id) {
    return null;
  }
  return findActiveMemberById(identity.member_id);
}

export async function resolveActiveMemberForLogin(identifier: MemberLoginIdentifier) {
  if (identifier.kind === "email") {
    return resolveMemberByVerifiedEmail(identifier.value);
  }
  return resolveMemberByMattermostUsername(identifier.value);
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
