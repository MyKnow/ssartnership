import {
  findMmUserDirectoryEntryByUserId,
  upsertMmUserDirectorySnapshot,
} from "@/lib/mm-directory";
import { withActiveMattermostSenderForGeneration } from "@/lib/mattermost-senders/service";
import { generateTempPassword, hashPassword } from "@/lib/password";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import { SITE_NAME } from "@/lib/site";
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
  wrapManualMemberAddDbError,
} from "./shared";

export function buildManualMemberPayload(input: {
  mattermostAccountId: string;
  displayName: string;
  campus: string | null;
  generation: ManualMemberAddYear;
  staffSourceGeneration: number | null;
  passwordHash: string;
  passwordSalt: string;
  now: string;
}) {
  return {
    mattermost_account_id: input.mattermostAccountId,
    display_name: input.displayName,
    generation: input.generation,
    staff_source_generation: input.staffSourceGeneration,
    campus: input.campus,
    password_hash: input.passwordHash,
    password_salt: input.passwordSalt,
    must_change_password: true,
    updated_at: input.now,
  };
}

async function ensureManualMemberDirectory(input: {
  profile: {
    mattermostUserId: string;
    username: string;
    displayName: string;
  };
  requestedYear: ManualMemberAddYear;
  resolvedYear: number;
}) {
  await upsertMmUserDirectorySnapshot({
    mmUserId: input.profile.mattermostUserId,
    mmUsername: input.profile.username,
    displayName: input.profile.displayName,
    campus: null,
    isStaff: input.requestedYear === 0,
    sourceYears: [input.resolvedYear],
  });

  const directory = await findMmUserDirectoryEntryByUserId(
    input.profile.mattermostUserId,
  );
  if (!directory?.id) {
    throw new Error("Mattermost 계정 연결을 저장하지 못했습니다.");
  }
  return directory;
}

export async function provisionManualMembers(
  requestedYear: ManualMemberAddYear,
  inputs: ManualMemberAddInput[],
): Promise<ManualMemberAddBatchResult> {
  const supabase = getSupabaseAdminClient();
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

      const directory = await ensureManualMemberDirectory({
        profile: resolution.profile,
        requestedYear,
        resolvedYear: resolution.resolvedYear,
      });
      const existingMember = await findExistingMemberByMmUser(
        resolution.user.id,
      );
      const tempPassword = generateTempPassword(12);
      const { hash, salt } = hashPassword(tempPassword);
      const now = new Date().toISOString();
      const nextCampus = resolution.profile.campus ?? existingMember?.campus ?? null;
      const payload = buildManualMemberPayload({
        mattermostAccountId: directory.id,
        displayName: resolution.profile.displayName,
        campus: nextCampus,
        generation: requestedYear,
        staffSourceGeneration:
          requestedYear === 0 ? resolution.resolvedYear : null,
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
        if (error || !insertedMember?.id) {
          throw wrapManualMemberAddDbError(error, "회원 정보를 저장하지 못했습니다.");
        }
        memberId = insertedMember.id as string;
      }

      const itemBase = {
        raw: input.raw,
        username: input.username,
        requestedYear,
        resolvedYear: resolution.resolvedYear,
        memberId,
        mmUserId: resolution.user.id,
        mmUsername: resolution.user.username,
        displayName: resolution.profile.displayName,
        campus: nextCampus,
        staffSourceYear: requestedYear === 0 ? resolution.resolvedYear : null,
        action,
      } as const;

      try {
        const template = await resolveNotificationTemplate(
          "mattermost.manual_member_temporary_password",
        );
        const variables = {
          siteName: SITE_NAME,
          displayName: resolution.profile.displayName || "회원",
          temporaryPassword: tempPassword,
        };
        const message = [
          renderNotificationTemplate(template.titleTemplate, variables),
          renderNotificationTemplate(template.bodyTemplate, variables),
        ].join("\n\n");
        await withActiveMattermostSenderForGeneration(
          resolution.resolvedYear,
          (session) => session.sendDirectMessage(
            resolution.user.id,
            message,
          ),
        );

        items.push({
          ...itemBase,
          status: "success",
          reason: null,
        });
        success += 1;
      } catch {
        let rollbackReason: string | null = null;
        try {
          await rollbackManualMemberProvision({
            memberId,
            existingMember,
          });
        } catch (rollbackError) {
          rollbackReason =
            rollbackError instanceof Error ? rollbackError.message : "롤백 실패";
        }

        items.push({
          ...itemBase,
          status: "failed",
          reason: rollbackReason
            ? `임시 비밀번호 전송 실패 / 롤백 실패: ${rollbackReason}`
            : "임시 비밀번호 전송 실패",
        });
        failed += 1;
      }
    } catch {
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
        reason: "수동 추가 실패",
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
