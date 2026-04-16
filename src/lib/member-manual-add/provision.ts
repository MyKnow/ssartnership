import {
  createDirectChannel,
  getUserImage,
  sendPost,
} from "@/lib/mattermost";
import { parseSsafyProfileFromUser } from "@/lib/mm-profile";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { validateMmUsername } from "@/lib/validation";
import {
  findExistingMemberByMmUser,
  resolveManualMemberResolution,
} from "./lookup";
import { rollbackManualMemberProvision } from "./rollback";
import {
  type ManualMemberAddBatchResult,
  type ManualMemberAddInput,
  type ManualMemberAddItem,
  type ManualMemberAddYear,
  type SenderSession,
  wrapManualMemberAddDbError,
} from "./shared";
import type { MemberRow } from "@/lib/mm-member-sync";
import type { MMUser } from "@/lib/mattermost";

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
          throw wrapManualMemberAddDbError(error, "회원 정보를 저장하지 못했습니다.");
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
          throw wrapManualMemberAddDbError(error, "회원 정보를 저장하지 못했습니다.");
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
