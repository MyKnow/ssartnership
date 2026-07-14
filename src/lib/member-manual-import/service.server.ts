import { randomUUID } from "node:crypto";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getConfiguredCurrentSsafyYear,
  getConfiguredManualMemberMmLookupGenerations,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password";
import { normalizeMattermostProfileImage } from "@/lib/graduate-verification-files";
import {
  MEMBER_PROFILE_IMAGES_BUCKET,
  removeGraduateStoredObject,
  storeMemberProfileImage,
} from "@/lib/graduate-verification-storage";
import {
  findMmUserDirectoryEntryByUserId,
  upsertMmUserDirectorySnapshot,
} from "@/lib/mm-directory";
import { getSsafyVerifyServerApiConfig } from "@/lib/ssafy-verify/config";
import { createSsafyVerifyApiTraceLogger } from "@/lib/ssafy-verify/api-trace";
import {
  extractSsafyVerifyMemberProfiles,
  toMmUserDirectorySnapshot,
  toSsafyVerifyMattermostUser,
  type SsafyVerifyMemberProfile,
} from "@/lib/ssafy-verify/profile";
import { createSsafyVerifyServerApiClient } from "@/lib/ssafy-verify/server-api";
import { createSmtpTransport, getSmtpConfig } from "@/lib/smtp";
import {
  MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES,
  MANUAL_MEMBER_IMPORT_LIMITS,
  validateManualMemberImportPhotoManifest,
  validateManualMemberImportRows,
  type ManualMemberImportPhotoManifestEntry,
  type ManualMemberImportRawRow,
} from "./shared";

export const MANUAL_MEMBER_IMPORT_STAGING_BUCKET = "manual-member-import-staging";
const IMPORT_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_ACTION_TTL_MS = 24 * 60 * 60 * 1000;

type ImportBatchRow = {
  id: string;
  created_by_admin_id: string;
  status: "staging" | "ready" | "processing" | "completed" | "expired";
  expires_at: string;
};

type ImportRow = {
  id: string;
  batch_id: string;
  row_number: number;
  generation: number;
  display_name: string | null;
  campus: string | null;
  mm_username: string | null;
  email: string | null;
  email_normalized: string | null;
  photo_filename: string | null;
  staging_bucket: string | null;
  staging_path: string | null;
  photo_content_type: string | null;
  photo_size_bytes: number | null;
};

type ResolvedVerifyMember = {
  profile: SsafyVerifyMemberProfile;
  mattermostAccountId: string;
  mattermostUserId: string;
  resolvedGeneration: number;
};

export type ManualMemberImportPreflightResult =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      batchId: string;
      expiresAt: string;
      uploads: Array<{
        rowNumber: number;
        filename: string;
        signedUrl: string;
      }>;
    };

export type ManualMemberImportCommitItem = {
  rowNumber: number;
  status: "success" | "failed";
  name: string | null;
  mmId: string | null;
  email: string | null;
  deliveryChannel: "mattermost" | "email" | null;
  reason: string | null;
};

export type ManualMemberImportCommitResult = {
  batchId: string;
  total: number;
  success: number;
  failed: number;
  items: ManualMemberImportCommitItem[];
};

function toErrors(messages: Array<{ rowNumber: number | null; message: string }>) {
  return messages.map((item) =>
    item.rowNumber === null ? item.message : `${item.rowNumber}행: ${item.message}`,
  );
}

function getManualMemberNotificationConfig() {
  const templateKey = process.env.SSAFY_VERIFY_MANUAL_MEMBER_SETUP_TEMPLATE_KEY?.trim();
  const purpose = process.env.SSAFY_VERIFY_MANUAL_MEMBER_SETUP_PURPOSE?.trim();
  if (!templateKey || !purpose) {
    throw new Error("SSAFY Verify 수동 회원 설정 알림 템플릿이 설정되지 않았습니다.");
  }
  return { templateKey, purpose };
}

function buildSetupUrl(token: string) {
  const url = new URL("/auth/member/setup", SITE_URL);
  // Fragment values are not sent in request paths or Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendSetupEmail(input: {
  email: string;
  displayName: string;
  token: string;
  reset: boolean;
}) {
  const smtpConfig = getSmtpConfig();
  const transport = createSmtpTransport(smtpConfig);
  const setupUrl = buildSetupUrl(input.token);
  const safeName = escapeHtml(input.displayName || "회원");
  const safeUrl = escapeHtml(setupUrl);
  const heading = input.reset ? "비밀번호 재설정" : "계정 비밀번호 설정";
  await transport.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.email,
    subject: `[${SITE_NAME}] ${heading}`,
    text: [
      `${input.displayName || "회원"}님, 아래 링크에서 비밀번호를 ${input.reset ? "재설정" : "설정"}해 주세요.`,
      "",
      setupUrl,
      "",
      "링크는 24시간 동안 한 번만 사용할 수 있습니다.",
    ].join("\n"),
    html: `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.7"><h2>${heading}</h2><p>${safeName}님, 아래 링크에서 비밀번호를 설정해 주세요.</p><p><a href="${safeUrl}">비밀번호 설정하기</a></p><p>링크는 24시간 동안 한 번만 사용할 수 있습니다.</p></div>`,
  });
}

function getSafeFailureMessage(error: unknown) {
  if (!(error instanceof Error)) return "회원 생성에 실패했습니다.";
  if (/^(XLSX|회원 가져오기|기수|이름|캠퍼스|MM ID|이메일|사진 파일명|사진 목록|사진 ZIP|한 번에|가져올 회원 행)/.test(error.message)) {
    return error.message;
  }
  if (/duplicate|already|exists/i.test(error.message)) return "이미 활성화된 MM ID 또는 이메일입니다.";
  if (/photo|사진/i.test(error.message)) return "사진을 처리하지 못했습니다.";
  if (/Verify|mattermost|SSAFY/i.test(error.message)) return "SSAFY Verify 조회 또는 알림에 실패했습니다.";
  if (/email|SMTP/i.test(error.message)) return "이메일 알림을 보낼 수 없습니다.";
  return "회원 생성에 실패했습니다.";
}

function isSupportedImageContentType(value: string | null): value is (typeof MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES)[number] {
  return Boolean(value && MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES.includes(value as (typeof MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES)[number]));
}

async function resolveVerifyMember(input: {
  mmUsername: string;
  generation: number;
  mmLookupGenerations: number[];
}) {
  const years = input.generation === 0
    ? input.mmLookupGenerations
    : [input.generation];
  const client = createSsafyVerifyServerApiClient(getSsafyVerifyServerApiConfig(), {
    trace: createSsafyVerifyApiTraceLogger({
      actorType: "system",
      identifier: input.mmUsername,
      properties: { flow: "manual_member_import_lookup", generation: input.generation },
    }),
  });
  for (const generation of years) {
    const response = await client.findMattermostUsers({
      username: input.mmUsername,
      cohort: generation,
    });
    const profile = extractSsafyVerifyMemberProfiles(response).find((item) =>
      input.generation === 0 ? item.isStaff : !item.isStaff,
    );
    if (!profile) continue;
    const snapshot = toMmUserDirectorySnapshot(profile, [input.generation, generation]);
    await upsertMmUserDirectorySnapshot({
      ...snapshot,
      isStaff: input.generation === 0 || snapshot.isStaff,
    });
    const directory = await findMmUserDirectoryEntryByUserId(profile.mattermostUserId);
    if (!directory?.id) throw new Error("MM 계정 연결을 저장하지 못했습니다.");
    return {
      profile,
      mattermostAccountId: directory.id,
      mattermostUserId: toSsafyVerifyMattermostUser(profile).id,
      resolvedGeneration: generation,
    } satisfies ResolvedVerifyMember;
  }
  throw new Error("SSAFY Verify에서 회원을 찾지 못했습니다.");
}

async function ensureNoActiveDuplicate(input: {
  email: string | null;
  mattermostAccountId: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  if (input.email) {
    const { data, error } = await supabase
      .from("members")
      .select("id")
      .eq("email_normalized", input.email)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error("기존 이메일을 확인하지 못했습니다.");
    if (data?.id) throw new Error("existing_email");
  }
  if (input.mattermostAccountId) {
    const { data, error } = await supabase
      .from("members")
      .select("id")
      .eq("mattermost_account_id", input.mattermostAccountId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error("기존 MM ID를 확인하지 못했습니다.");
    if (data?.id) throw new Error("existing_mattermost");
  }
}

async function createManualPasswordAction(input: {
  memberId: string;
  purpose: "manual_initial_setup" | "manual_password_reset";
  deliveryChannel: "mattermost" | "email";
}) {
  const token = generateOpaqueToken();
  const supabase = getSupabaseAdminClient();
  const { error: consumeError } = await supabase
    .from("member_password_action_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("member_id", input.memberId)
    .eq("purpose", input.purpose)
    .is("consumed_at", null);
  if (consumeError) throw new Error("기존 설정 링크를 정리하지 못했습니다.");
  const { error } = await supabase.from("member_password_action_tokens").insert({
    member_id: input.memberId,
    purpose: input.purpose,
    delivery_channel: input.deliveryChannel,
    token_hash: hashOpaqueToken(token),
    expires_at: new Date(Date.now() + PASSWORD_ACTION_TTL_MS).toISOString(),
  });
  if (error) throw new Error("비밀번호 설정 링크를 준비하지 못했습니다.");
  return token;
}

async function removeStagingFile(row: ImportRow) {
  if (row.staging_bucket && row.staging_path) {
    await removeGraduateStoredObject(row.staging_bucket, row.staging_path);
  }
}

async function attachPendingPhoto(memberId: string, row: ImportRow) {
  if (!row.staging_bucket || !row.staging_path || !isSupportedImageContentType(row.photo_content_type)) {
    return null;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(row.staging_bucket)
    .download(row.staging_path);
  if (error || !data) throw new Error("사진 업로드 파일을 찾지 못했습니다.");
  const source = Buffer.from(await data.arrayBuffer());
  if (source.length === 0 || source.length > MANUAL_MEMBER_IMPORT_LIMITS.imageBytes) {
    throw new Error("사진 크기를 확인하지 못했습니다.");
  }
  const normalized = await normalizeMattermostProfileImage({
    contentType: row.photo_content_type,
    source,
  });
  const storagePath = await storeMemberProfileImage({
    memberId,
    sha256: normalized.sha256,
    buffer: normalized.buffer,
    variant: `manual-${randomUUID()}`,
  });
  const { data: image, error: insertError } = await supabase
    .from("member_profile_images")
    .insert({
      member_id: memberId,
      storage_path: storagePath,
      sha256: normalized.sha256,
      content_type: "image/webp",
      width: normalized.width,
      height: normalized.height,
      source: "manual_admin",
      status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !image?.id) {
    await removeGraduateStoredObject(MEMBER_PROFILE_IMAGES_BUCKET, storagePath).catch(() => undefined);
    throw new Error("사진 검토 요청을 저장하지 못했습니다.");
  }
  return storagePath;
}

async function deleteCreatedMember(memberId: string | null, profileImagePath: string | null) {
  if (profileImagePath) {
    await removeGraduateStoredObject(MEMBER_PROFILE_IMAGES_BUCKET, profileImagePath).catch(() => undefined);
  }
  if (memberId) {
    await getSupabaseAdminClient().from("members").delete().eq("id", memberId);
  }
}

export async function prepareManualMemberImport(input: {
  adminId: string;
  rows: ManualMemberImportRawRow[];
  photos: ManualMemberImportPhotoManifestEntry[];
}): Promise<ManualMemberImportPreflightResult> {
  try {
    const settings = await getSsafyCycleSettings();
    const rowsResult = validateManualMemberImportRows(input.rows, {
      currentGeneration: getConfiguredCurrentSsafyYear(settings),
      mmLookupGenerations: getConfiguredManualMemberMmLookupGenerations(settings),
    });
    const photoResult = validateManualMemberImportPhotoManifest(
      rowsResult.acceptedRows,
      input.photos,
    );
    const errors = [...rowsResult.errors, ...photoResult.errors];
    if (errors.length > 0 || rowsResult.acceptedRows.length === 0) {
      return { ok: false, errors: toErrors(errors.length > 0 ? errors : [{ rowNumber: null, message: "가져올 회원 행이 없습니다." }]) };
    }

    const supabase = getSupabaseAdminClient();
    const expiresAt = new Date(Date.now() + IMPORT_TTL_MS).toISOString();
    const { data: batch, error: batchError } = await supabase
      .from("manual_member_import_batches")
      .insert({ created_by_admin_id: input.adminId, expires_at: expiresAt })
      .select("id")
      .single();
    if (batchError || !batch?.id) throw new Error("가져오기 배치를 준비하지 못했습니다.");

    const photoByFilename = new Map(
      input.photos.map((photo) => [photo.filename.toLowerCase(), photo]),
    );
    const insertRows = rowsResult.acceptedRows.map((row) => {
      const photo = row.photoFilename
        ? photoByFilename.get(row.photoFilename.toLowerCase()) ?? null
        : null;
      return {
        batch_id: batch.id,
        row_number: row.rowNumber,
        generation: row.generation,
        display_name: row.name,
        campus: row.campus,
        mm_username: row.mmId,
        email: row.email,
        email_normalized: row.email,
        photo_filename: row.photoFilename,
        staging_bucket: photo ? MANUAL_MEMBER_IMPORT_STAGING_BUCKET : null,
        staging_path: photo ? `batches/${batch.id}/${randomUUID()}-${row.photoFilename}` : null,
        photo_content_type: photo?.contentType ?? null,
        photo_size_bytes: photo?.size ?? null,
      };
    });
    const { data: storedRows, error: rowsError } = await supabase
      .from("manual_member_import_rows")
      .insert(insertRows)
      .select("id,row_number,photo_filename,staging_path,photo_content_type");
    if (rowsError || !storedRows) {
      await supabase.from("manual_member_import_batches").delete().eq("id", batch.id);
      throw new Error("가져오기 행을 저장하지 못했습니다.");
    }

    const uploads = [] as Array<{ rowNumber: number; filename: string; signedUrl: string }>;
    for (const row of storedRows as Array<{ row_number: number; photo_filename: string | null; staging_path: string | null; photo_content_type: string | null }>) {
      if (!row.photo_filename || !row.staging_path || !row.photo_content_type) continue;
      const { data, error } = await supabase.storage
        .from(MANUAL_MEMBER_IMPORT_STAGING_BUCKET)
        .createSignedUploadUrl(row.staging_path);
      if (error || !data?.signedUrl) {
        await supabase.from("manual_member_import_batches").delete().eq("id", batch.id);
        throw new Error("사진 업로드 URL을 발급하지 못했습니다.");
      }
      uploads.push({ rowNumber: row.row_number, filename: row.photo_filename, signedUrl: data.signedUrl });
    }
    await supabase.from("manual_member_import_batches").update({ status: "ready" }).eq("id", batch.id);
    return { ok: true, batchId: batch.id as string, expiresAt, uploads };
  } catch (error) {
    return { ok: false, errors: [getSafeFailureMessage(error)] };
  }
}

async function processImportRow(row: ImportRow, mmLookupGenerations: number[]): Promise<ManualMemberImportCommitItem> {
  const supabase = getSupabaseAdminClient();
  let memberId: string | null = null;
  let profileImagePath: string | null = null;
  const item = {
    rowNumber: row.row_number,
    name: row.display_name,
    mmId: row.mm_username,
    email: row.email_normalized,
  };
  try {
    const verified = row.mm_username
      ? await resolveVerifyMember({
          mmUsername: row.mm_username,
          generation: row.generation,
          mmLookupGenerations,
        })
      : null;
    const displayName = verified?.profile.displayName ?? row.display_name;
    const campus = verified?.profile.campus ?? row.campus;
    if (!displayName || !campus) throw new Error("회원 프로필 정보가 부족합니다.");
    await ensureNoActiveDuplicate({
      email: row.email_normalized,
      mattermostAccountId: verified?.mattermostAccountId ?? null,
    });
    const { data: member, error: insertError } = await supabase
      .from("members")
      .insert({
        display_name: displayName,
        generation: row.generation,
        staff_source_generation: row.generation === 0 ? verified?.resolvedGeneration ?? null : null,
        campus,
        mattermost_account_id: verified?.mattermostAccountId ?? null,
        email: row.email_normalized,
        email_normalized: row.email_normalized,
        must_change_password: true,
      })
      .select("id")
      .single();
    if (insertError || !member?.id) throw new Error("회원 정보를 저장하지 못했습니다.");
    memberId = member.id as string;
    profileImagePath = await attachPendingPhoto(memberId, row);

    let deliveryChannel: "mattermost" | "email" | null = null;
    let setupToken: string | null = null;
    if (verified) {
      try {
        setupToken = await createManualPasswordAction({
          memberId,
          purpose: "manual_initial_setup",
          deliveryChannel: "mattermost",
        });
        const notification = getManualMemberNotificationConfig();
        const client = createSsafyVerifyServerApiClient(getSsafyVerifyServerApiConfig());
        await client.sendMattermostNotification({
          recipient: { mattermostUserId: verified.mattermostUserId },
          purpose: notification.purpose,
          templateKey: notification.templateKey,
          message: {
            title: `${SITE_NAME} 계정 설정`,
            body: `아래 링크에서 ${SITE_NAME} 비밀번호를 설정해 주세요.\n${buildSetupUrl(setupToken)}\n\n링크는 24시간 동안 한 번만 사용할 수 있습니다.`,
          },
          idempotencyKey: `manual-member-setup:${memberId}:${randomUUID()}`,
        });
        deliveryChannel = "mattermost";
      } catch {
        setupToken = null;
      }
    }
    if (!deliveryChannel && row.email_normalized) {
      setupToken = await createManualPasswordAction({
        memberId,
        purpose: "manual_initial_setup",
        deliveryChannel: "email",
      });
      await sendSetupEmail({
        email: row.email_normalized,
        displayName,
        token: setupToken,
        reset: false,
      });
      deliveryChannel = "email";
    }
    if (!deliveryChannel) throw new Error("계정 설정 링크를 전달할 수 없습니다.");
    const stagingDeletedAt = await removeStagingFile(row)
      .then(() => new Date().toISOString())
      .catch(() => null);
    await supabase.from("manual_member_import_rows").update({
      member_id: memberId,
      status: "created",
      delivery_channel: deliveryChannel,
      error_code: null,
      error_message: null,
      staging_deleted_at: stagingDeletedAt,
    }).eq("id", row.id);
    return { ...item, name: displayName, status: "success", deliveryChannel, reason: null };
  } catch (error) {
    await deleteCreatedMember(memberId, profileImagePath);
    const reason = getSafeFailureMessage(error);
    await supabase.from("manual_member_import_rows").update({
      status: "failed",
      error_code: "member_create_failed",
      error_message: reason,
      member_id: null,
      delivery_channel: null,
    }).eq("id", row.id);
    return { ...item, status: "failed", deliveryChannel: null, reason };
  }
}

export async function commitManualMemberImport(input: {
  adminId: string;
  batchId: string;
}): Promise<ManualMemberImportCommitResult> {
  const supabase = getSupabaseAdminClient();
  const { data: batchData, error: batchError } = await supabase
    .from("manual_member_import_batches")
    .select("id,created_by_admin_id,status,expires_at")
    .eq("id", input.batchId)
    .eq("created_by_admin_id", input.adminId)
    .maybeSingle();
  const batch = (batchData as ImportBatchRow | null) ?? null;
  if (batchError || !batch || new Date(batch.expires_at).getTime() <= Date.now()) {
    throw new Error("가져오기 배치가 없거나 만료되었습니다.");
  }
  const { data: rowsData, error: rowsError } = await supabase
    .from("manual_member_import_rows")
    .select("id,batch_id,row_number,generation,display_name,campus,mm_username,email,email_normalized,photo_filename,staging_bucket,staging_path,photo_content_type,photo_size_bytes")
    .eq("batch_id", input.batchId)
    .in("status", ["staged", "failed"])
    .order("row_number");
  if (rowsError) throw new Error("가져오기 행을 불러오지 못했습니다.");
  await supabase.from("manual_member_import_batches").update({ status: "processing" }).eq("id", input.batchId);
  const settings = await getSsafyCycleSettings();
  const mmLookupGenerations = getConfiguredManualMemberMmLookupGenerations(settings);
  const items: ManualMemberImportCommitItem[] = [];
  for (const row of (rowsData ?? []) as ImportRow[]) {
    items.push(await processImportRow(row, mmLookupGenerations));
  }
  const success = items.filter((item) => item.status === "success").length;
  const failed = items.length - success;
  await supabase.from("manual_member_import_batches").update({
    status: "completed",
    completed_at: new Date().toISOString(),
  }).eq("id", input.batchId);
  return { batchId: input.batchId, total: items.length, success, failed, items };
}

export async function completeManualMemberPasswordAction(input: {
  token: string;
  passwordHash: string;
  passwordSalt: string;
}) {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "complete_manual_member_password_action",
    {
      p_token_hash: hashOpaqueToken(input.token),
      p_password_hash: input.passwordHash,
      p_password_salt: input.passwordSalt,
    },
  );
  if (error || typeof data !== "string") return null;
  return data;
}

export async function issueManualMemberPasswordReset(email: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .select("id,display_name,email_normalized,must_change_password")
    .eq("email_normalized", email)
    .not("email_verified_at", "is", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data?.id || data.must_change_password || !data.email_normalized) {
    return false;
  }
  const token = await createManualPasswordAction({
    memberId: data.id as string,
    purpose: "manual_password_reset",
    deliveryChannel: "email",
  });
  await sendSetupEmail({
    email: data.email_normalized as string,
    displayName: String(data.display_name ?? "회원"),
    token,
    reset: true,
  });
  return true;
}
