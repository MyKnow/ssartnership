import { findMmUserDirectoryEntryByUserId, upsertMmUserDirectorySnapshot } from "@/lib/mm-directory";
import { getMmUserDirectoryEntriesByAccountIds } from "@/lib/mm-directory/identities";
import { resolveManualMemberResolution } from "@/lib/member-manual-add/lookup";
import { findManualMemberImportReissueMember } from "./repository.supabase";
import type { ResolvedMattermostMember, ManualMemberImportReissueMember } from "./types";

export async function resolveMattermostMember(input: {
  mmUsername: string;
  generation: number;
}) {
  const resolution = await resolveManualMemberResolution(
    input.mmUsername,
    input.generation,
  );
  if (!resolution) {
    throw new Error("Mattermost에서 회원을 찾지 못했습니다.");
  }
  await upsertMmUserDirectorySnapshot({
    mmUserId: resolution.user.id,
    mmUsername: resolution.user.username,
    displayName: resolution.profile.displayName,
    campus: null,
    isStaff: input.generation === 0,
    sourceYears: [resolution.resolvedYear],
  });
  const directory = await findMmUserDirectoryEntryByUserId(resolution.user.id);
  if (!directory?.id) {
    throw new Error("Mattermost 계정 연결을 저장하지 못했습니다.");
  }
  return {
    displayName: resolution.profile.displayName,
    mattermostAccountId: directory.id,
    mattermostUserId: resolution.user.id,
    resolvedGeneration: resolution.resolvedYear,
  } satisfies ResolvedMattermostMember;
}

type ManualMemberImportReissueMattermostRecipient = {
  mattermostUserId: string;
  displayName: string;
  senderGeneration: number;
};

type ManualMemberImportReissueEmailRecipient = {
  email: string;
  displayName: string;
};

export async function resolveManualMemberImportReissueMember(input: {
  memberId: string;
}): Promise<ManualMemberImportReissueMember> {
  const member = await findManualMemberImportReissueMember(input.memberId);
  if (!member || !member.must_change_password) {
    throw new Error("초기 설정 링크를 발급할 수 있는 회원 상태가 아닙니다.");
  }
  return member;
}

export async function resolveManualMemberImportReissueMattermostRecipient(input: {
  member: ManualMemberImportReissueMember;
  fallbackDisplayName: string | null;
}): Promise<ManualMemberImportReissueMattermostRecipient> {
  if (!input.member.mattermost_account_id) {
    throw new Error("회원의 연결된 MM 계정을 확인하지 못했습니다.");
  }

  const directoryByAccountId = await getMmUserDirectoryEntriesByAccountIds([
    input.member.mattermost_account_id,
  ]);
  const directory = directoryByAccountId.get(input.member.mattermost_account_id);
  if (!directory?.is_active || !directory.mm_user_id) {
    throw new Error("회원의 연결된 MM 계정을 확인하지 못했습니다.");
  }
  const configuredSenderGeneration = input.member.generation === 0
    ? input.member.staff_source_generation
    : input.member.generation;
  if (
    typeof configuredSenderGeneration !== "number"
    || !Number.isSafeInteger(configuredSenderGeneration)
    || configuredSenderGeneration <= 0
  ) {
    throw new Error("회원의 Mattermost Sender 기수를 확인하지 못했습니다.");
  }

  return {
    // Mattermost user IDs are immutable. Do not resolve the stored username
    // again: usernames can be renamed or reused by another account.
    mattermostUserId: directory.mm_user_id,
    displayName: input.member.display_name?.trim() || input.fallbackDisplayName?.trim() || "회원",
    senderGeneration: configuredSenderGeneration,
  };
}

export async function resolveManualMemberImportReissueEmailRecipient(input: {
  member: ManualMemberImportReissueMember;
  importEmailNormalized: string | null;
  fallbackDisplayName: string | null;
}): Promise<ManualMemberImportReissueEmailRecipient> {
  if (
    !input.member.email_normalized
    || input.member.email_normalized !== input.importEmailNormalized
  ) {
    // Do not deliver to an address which has been replaced since the import.
    // The administrator must resolve the changed member record separately.
    throw new Error("회원의 현재 이메일 주소를 확인하지 못했습니다.");
  }
  return {
    email: input.member.email_normalized,
    displayName: input.member.display_name?.trim() || input.fallbackDisplayName?.trim() || "회원",
  };
}
