import { logAdminAudit } from "@/lib/activity-logs";
import {
  buildMemberSyncLogProperties,
  syncMemberSnapshot,
  type MemberRow,
} from "@/lib/mm-member-sync";
import { recordRequiredPolicyConsent } from "@/lib/policy-documents";
import { hashPassword } from "@/lib/password";
import { setUserSession } from "@/lib/user-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getEffectiveSsafyYear,
  getPreferredStaffSourceYear,
} from "@/lib/ssafy-year";
import { getUserImage } from "@/lib/mattermost";
import { loginAsSsafySender } from "./mattermost";
import type { MmRouteContext } from "./types";

type DirectoryEntryLike = {
  source_years: number[];
  mm_username: string;
} | null;

type ResolvedStudentLike = {
  year: number;
  user: {
    username: string;
  };
} | null;

type ActivePoliciesLike = Awaited<
  ReturnType<typeof import("@/lib/policy-documents").getActiveRequiredPolicies>
>;

export async function finalizeVerifiedMember({
  context,
  mmUserId,
  directoryEntry,
  resolvedStudent,
  resolvedDisplayName,
  resolvedCampus,
  password,
  codeYear,
  activePolicies,
}: {
  context: MmRouteContext;
  mmUserId: string;
  directoryEntry: DirectoryEntryLike;
  resolvedStudent: ResolvedStudentLike;
  resolvedDisplayName: string | null;
  resolvedCampus: string | null;
  password: string;
  codeYear: number | null;
  activePolicies: ActivePoliciesLike;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: memberData } = await supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,campus,avatar_content_type,avatar_base64,updated_at",
    )
    .eq("mm_user_id", mmUserId)
    .maybeSingle();
  const member = (memberData as MemberRow | null) ?? null;
  const passwordRecord = hashPassword(password);
  const preferredStaffSourceYear = getPreferredStaffSourceYear(
    directoryEntry?.source_years ?? [],
  );
  const senderYear =
    codeYear === 0
      ? getEffectiveSsafyYear(
          member?.year ?? 0,
          null,
          [resolvedStudent?.year, preferredStaffSourceYear, 15, 14],
        )
      : codeYear;

  if (senderYear === null) {
    return {
      kind: "error" as const,
      error: "sender_unavailable",
      message: "운영진 회원 정보를 확인하지 못했습니다. 다시 시도해 주세요.",
    };
  }

  const senderLogin = await loginAsSsafySender(senderYear);
  const avatar = await getUserImage(senderLogin.token, mmUserId);
  const snapshot = {
    mmUserId,
    mmUsername:
      directoryEntry?.mm_username ?? resolvedStudent?.user.username ?? mmUserId,
    displayName: resolvedDisplayName ?? member?.display_name ?? mmUserId,
    campus: resolvedCampus ?? member?.campus ?? null,
    avatarFetched: Boolean(avatar),
    avatarContentType: avatar?.contentType ?? null,
    avatarBase64: avatar?.base64 ?? null,
  };

  const nextYear = codeYear ?? member?.year ?? null;
  let authenticatedMemberId = member?.id ?? null;
  let nextMember: MemberRow | null = member ?? null;

  if (member?.id) {
    const syncResult = await syncMemberSnapshot(member, snapshot);
    if (syncResult.updated) {
      await logAdminAudit({
        ...context,
        action: "member_sync",
        actorId: process.env.ADMIN_ID ?? "admin",
        targetType: "member",
        targetId: member.id,
        properties: buildMemberSyncLogProperties(syncResult, {
          source: "signup_complete",
        }),
      });
    }
    nextMember = syncResult.member;

    await supabase
      .from("members")
      .update({
        mm_user_id: mmUserId,
        mm_username: snapshot.mmUsername,
        display_name: snapshot.displayName,
        year: nextYear ?? codeYear,
        campus: nextMember.campus ?? null,
        avatar_content_type: snapshot.avatarFetched
          ? snapshot.avatarContentType
          : nextMember.avatar_content_type ?? null,
        avatar_base64: snapshot.avatarFetched
          ? snapshot.avatarBase64
          : nextMember.avatar_base64 ?? null,
        password_hash: passwordRecord.hash,
        password_salt: passwordRecord.salt,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);
  } else {
    const { data: inserted } = await supabase
      .from("members")
      .insert({
        mm_user_id: mmUserId,
        mm_username: snapshot.mmUsername,
        display_name: snapshot.displayName,
        year: nextYear ?? codeYear,
        campus: snapshot.campus,
        avatar_content_type: snapshot.avatarContentType,
        avatar_base64: snapshot.avatarBase64,
        password_hash: passwordRecord.hash,
        password_salt: passwordRecord.salt,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (inserted?.id) {
      authenticatedMemberId = inserted.id;
    }
  }

  if (!authenticatedMemberId) {
    return {
      kind: "error" as const,
      error: "member_creation_failed",
      message: "회원 생성을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  await recordRequiredPolicyConsent({
    memberId: authenticatedMemberId,
    activePolicies,
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent ?? null,
  });
  await setUserSession(authenticatedMemberId, false);

  return {
    kind: "success" as const,
    authenticatedMemberId,
    nextYear,
    campus: nextMember?.campus ?? snapshot.campus,
    existingMember: Boolean(member?.id),
    mmUsername: snapshot.mmUsername,
  };
}
