import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { generateTempPassword, hashPassword } from "@/lib/password";
import {
  createDirectChannel,
  findUserInChannelByUsername,
  getStudentChannelConfig,
  getSenderCredentials,
  getUserImage,
  loginWithPassword,
  sendPost,
  type MMUser,
} from "@/lib/mattermost";
import { parseSsafyProfileFromUser } from "@/lib/mm-profile";
import type { MemberRow } from "@/lib/mm-member-sync";
import { normalizeMmUsername, validateMmUsername } from "@/lib/validation";

export type ManualMemberAddYear = 0 | 14 | 15;

export type ManualMemberAddInput = {
  raw: string;
  username: string;
};

export type ManualMemberAddItemStatus = "success" | "failed";

export type ManualMemberAddItem = {
  raw: string;
  username: string;
  requestedYear: ManualMemberAddYear;
  resolvedYear: number | null;
  memberId: string | null;
  mmUserId: string | null;
  mmUsername: string | null;
  displayName: string | null;
  campus: string | null;
  staffSourceYear: number | null;
  action: "created" | "updated" | null;
  status: ManualMemberAddItemStatus;
  reason: string | null;
};

export type ManualMemberAddBatchResult = {
  requestedYear: ManualMemberAddYear;
  total: number;
  success: number;
  failed: number;
  items: ManualMemberAddItem[];
};

export type ManualMemberAddFormState = ManualMemberAddBatchResult & {
  status: "idle" | "success" | "partial" | "error";
  message: string | null;
};

export const MANUAL_MEMBER_ADD_INITIAL_STATE: ManualMemberAddFormState = {
  status: "idle",
  message: null,
  requestedYear: 15,
  total: 0,
  success: 0,
  failed: 0,
  items: [],
};

const MANUAL_MEMBER_ADD_YEAR_FALLBACKS: ManualMemberAddYear[] = [15, 14];
const MEMBER_SELECT =
  "id,mm_user_id,mm_username,display_name,year,campus,password_hash,password_salt,must_change_password,avatar_content_type,avatar_base64,updated_at";

type SenderSession = {
  token: string;
  userId: string;
};

type ManualMemberResolution = {
  requestedYear: ManualMemberAddYear;
  resolvedYear: number;
  senderToken: string;
  senderUserId: string;
  user: MMUser;
};

type ExistingMemberRecord = MemberRow & {
  password_hash?: string | null;
  password_salt?: string | null;
  must_change_password?: boolean;
};

export function parseManualMemberAddInputList(value: string): ManualMemberAddInput[] {
  const seen = new Set<string>();
  const inputs: ManualMemberAddInput[] = [];

  for (const rawToken of value.split(/[\n,]/)) {
    const raw = rawToken.trim();
    if (!raw) {
      continue;
    }
    const username = normalizeMmUsername(raw);
    if (seen.has(username)) {
      continue;
    }
    seen.add(username);
    inputs.push({ raw, username });
  }

  return inputs;
}

async function getSenderSession(year: number, cache: Map<number, Promise<SenderSession>>) {
  const cached = cache.get(year);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const credentials = getSenderCredentials(year);
    const login = await loginWithPassword(credentials.loginId, credentials.password);
    return {
      token: login.token,
      userId: login.user.id,
    };
  })();

  cache.set(year, promise);

  try {
    return await promise;
  } catch (error) {
    cache.delete(year);
    throw error;
  }
}

async function resolveManualMemberResolution(
  username: string,
  requestedYear: ManualMemberAddYear,
  cache: Map<number, Promise<SenderSession>>,
): Promise<ManualMemberResolution | null> {
  const yearsToTry =
    requestedYear === 0 ? MANUAL_MEMBER_ADD_YEAR_FALLBACKS : [requestedYear];
  let lastError: Error | null = null;

  for (const year of yearsToTry) {
    try {
      const sender = await getSenderSession(year, cache);
      const channelConfig = getStudentChannelConfig(year);
      const user = await findUserInChannelByUsername(
        sender.token,
        username,
        channelConfig,
      );
      if (!user) {
        continue;
      }
      return {
        requestedYear,
        resolvedYear: year,
        senderToken: sender.token,
        senderUserId: sender.userId,
        user,
      };
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error("MM 사용자 조회 실패");
      if (requestedYear !== 0) {
        throw normalized;
      }
      lastError = normalized;
    }
  }

  if (lastError) {
    throw lastError;
  }
  return null;
}

async function findExistingMemberByMmUser(userId: string) {
  const supabase = getSupabaseAdminClient();

  const byUserId = await supabase
    .from("members")
    .select(MEMBER_SELECT)
    .eq("mm_user_id", userId)
    .maybeSingle();
  if (byUserId.error) {
    throw new Error(byUserId.error.message);
  }
  if (byUserId.data?.id) {
    return byUserId.data as ExistingMemberRecord;
  }

  return null;
}

async function rollbackManualMemberProvision(input: {
  memberId: string | null;
  existingMember: ExistingMemberRecord | null;
}) {
  if (!input.memberId) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  if (!input.existingMember) {
    const { error } = await supabase.from("members").delete().eq("id", input.memberId);
    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  const { error } = await supabase
    .from("members")
    .update({
      mm_user_id: input.existingMember.mm_user_id,
      mm_username: input.existingMember.mm_username,
      display_name: input.existingMember.display_name ?? null,
      year: input.existingMember.year,
      campus: input.existingMember.campus ?? null,
      password_hash: input.existingMember.password_hash ?? null,
      password_salt: input.existingMember.password_salt ?? null,
      must_change_password: Boolean(input.existingMember.must_change_password),
      avatar_content_type: input.existingMember.avatar_content_type ?? null,
      avatar_base64: input.existingMember.avatar_base64 ?? null,
      updated_at: input.existingMember.updated_at ?? new Date().toISOString(),
    })
    .eq("id", input.memberId);

  if (error) {
    throw new Error(error.message);
  }
}

function buildMemberPayload(input: {
  member: MemberRow | null;
  user: MMUser;
  displayName: string;
  campus: string | null;
  year: ManualMemberAddYear;
  avatarContentType: string | null;
  avatarBase64: string | null;
  passwordHash: string;
  passwordSalt: string;
  now: string;
}) {
  return {
    mm_user_id: input.user.id,
    mm_username: input.user.username,
    display_name: input.displayName,
    year: input.year,
    campus: input.campus,
    password_hash: input.passwordHash,
    password_salt: input.passwordSalt,
    must_change_password: true,
    avatar_content_type:
      input.avatarContentType ?? input.member?.avatar_content_type ?? null,
    avatar_base64: input.avatarBase64 ?? input.member?.avatar_base64 ?? null,
    updated_at: input.now,
  };
}

export async function provisionManualMembers(
  requestedYear: ManualMemberAddYear,
  inputs: ManualMemberAddInput[],
): Promise<ManualMemberAddBatchResult> {
  const supabase = getSupabaseAdminClient();
  const senderSessionCache = new Map<number, Promise<SenderSession>>();
  const items: ManualMemberAddItem[] = [];
  let success = 0;
  let failed = 0;

  for (const input of inputs) {
    const validationError = validateMmUsername(input.username);
    if (validationError) {
      items.push({
        raw: input.raw,
        username: input.username,
        requestedYear,
        resolvedYear: null,
        memberId: null,
        mmUserId: null,
        mmUsername: null,
        displayName: null,
        campus: null,
        staffSourceYear: null,
        action: null,
        status: "failed",
        reason: validationError,
      });
      failed += 1;
      continue;
    }

    try {
      const resolution = await resolveManualMemberResolution(
        input.username,
        requestedYear,
        senderSessionCache,
      );
      if (!resolution) {
        items.push({
          raw: input.raw,
          username: input.username,
          requestedYear,
          resolvedYear: null,
          memberId: null,
          mmUserId: null,
          mmUsername: null,
          displayName: null,
          campus: null,
          staffSourceYear: null,
          action: null,
          status: "failed",
          reason: "not_found",
        });
        failed += 1;
        continue;
      }

      const profile = parseSsafyProfileFromUser(resolution.user);
      const displayName =
        profile.displayName ?? resolution.user.nickname ?? resolution.user.username;
      const campus = profile.campus ?? null;
      const avatar = await getUserImage(
        resolution.senderToken,
        resolution.user.id,
      );
      const existingMember = await findExistingMemberByMmUser(resolution.user.id);
      const tempPassword = generateTempPassword(12);
      const { hash, salt } = hashPassword(tempPassword);
      const now = new Date().toISOString();
      const nextCampus = campus ?? existingMember?.campus ?? null;
      const payload = buildMemberPayload({
        member: existingMember,
        user: resolution.user,
        displayName,
        campus: nextCampus,
        year: requestedYear,
        avatarContentType: avatar?.contentType ?? null,
        avatarBase64: avatar?.base64 ?? null,
        passwordHash: hash,
        passwordSalt: salt,
        now,
      });

      let memberId = existingMember?.id ?? null;
      const action: "created" | "updated" = existingMember ? "updated" : "created";

      if (existingMember) {
        const { error } = await supabase
          .from("members")
          .update(payload)
          .eq("id", existingMember.id);
        if (error) {
          throw new Error(error.message);
        }
      } else {
        const { data: insertedMember, error } = await supabase
          .from("members")
          .insert({
            ...payload,
            created_at: now,
          })
          .select("id")
          .single();
        if (error) {
          throw new Error(error.message);
        }
        memberId = insertedMember?.id ?? null;
      }

      const itemBase = {
        raw: input.raw,
        username: input.username,
        requestedYear,
        resolvedYear: resolution.resolvedYear,
        memberId,
        mmUserId: resolution.user.id,
        mmUsername: resolution.user.username,
        displayName,
        campus: nextCampus,
        staffSourceYear: requestedYear === 0 ? resolution.resolvedYear : null,
        action,
      } as const;

      try {
        const dmChannel = await createDirectChannel(
          resolution.senderToken,
          resolution.senderUserId,
          resolution.user.id,
        );
        await sendPost(
          resolution.senderToken,
          dmChannel.id,
          [
            "SSARTNERSHIP 임시 비밀번호입니다.",
            "",
            "임시 비밀번호",
            "```plaintext",
            tempPassword,
            "```",
            "보안을 위해 로그인 후 반드시 변경해 주세요.",
          ].join("\n"),
        );

        items.push({
          ...itemBase,
          status: "success",
          reason: null,
        });
        success += 1;
      } catch (error) {
        let rollbackReason: string | null = null;
        try {
          await rollbackManualMemberProvision({
            memberId,
            existingMember,
          });
        } catch (rollbackError) {
          rollbackReason =
            rollbackError instanceof Error
              ? rollbackError.message
              : "롤백 실패";
        }

        items.push({
          ...itemBase,
          status: "failed",
          reason:
            error instanceof Error
              ? `임시 비밀번호 전송 실패: ${error.message}${rollbackReason ? ` / 롤백 실패: ${rollbackReason}` : ""}`
              : `임시 비밀번호 전송 실패${rollbackReason ? ` / 롤백 실패: ${rollbackReason}` : ""}`,
        });
        failed += 1;
      }
    } catch (error) {
      items.push({
        raw: input.raw,
        username: input.username,
        requestedYear,
        resolvedYear: null,
        memberId: null,
        mmUserId: null,
        mmUsername: null,
        displayName: null,
        campus: null,
        staffSourceYear: null,
        action: null,
        status: "failed",
        reason: error instanceof Error ? error.message : "수동 추가 실패",
      });
      failed += 1;
    }
  }

  return {
    requestedYear,
    total: inputs.length,
    success,
    failed,
    items,
  };
}
