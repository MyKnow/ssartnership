import { randomUUID } from "node:crypto";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { createHmacDigest } from "@/lib/hmac.js";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getConfiguredCurrentSsafyYear,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import { generateOpaqueToken, hashOpaqueToken } from "@/lib/password";
import { normalizeMattermostProfileImage } from "@/lib/graduate-verification-files";
import {
  MEMBER_PROFILE_IMAGES_BUCKET,
  removeGraduateStoredObject,
  storeMemberProfileImage,
} from "@/lib/graduate-verification-storage";
import { resolveImageTransformPolicy } from "@/lib/image-upload/policy";
import { getImageUploadRepository } from "@/lib/image-upload/repository.supabase";
import {
  findMmUserDirectoryEntryByUserId,
  upsertMmUserDirectorySnapshot,
} from "@/lib/mm-directory";
import { getMmUserDirectoryEntriesByAccountIds } from "@/lib/mm-directory/identities";
import { resolveManualMemberResolution } from "@/lib/member-manual-add/lookup";
import { renderEmailTemplateBody } from "@/lib/email-content";
import { withActiveMattermostSenderForGeneration } from "@/lib/mattermost-senders/service";
import { resolveNotificationTemplate } from "@/lib/notification-templates/repository.server";
import { renderNotificationTemplate } from "@/lib/notification-templates/template";
import { createSmtpTransport, getSmtpConfig } from "@/lib/smtp";
import {
  MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES,
  MANUAL_MEMBER_IMPORT_LIMITS,
  validateManualMemberImportPhotoManifest,
  validateManualMemberImportRows,
  type ManualMemberImportPhotoManifestEntry,
  type ManualMemberImportRawRow,
} from "./shared";
import { getManualMemberImportDuplicateKind } from "./duplicate";

// New import batches use the common image-upload staging bucket. This legacy
// bucket remains readable only while already-created batches are completed.
export const MANUAL_MEMBER_IMPORT_STAGING_BUCKET = "manual-member-import-staging";
const IMPORT_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_ACTION_TTL_MS = 24 * 60 * 60 * 1000;
const PROCESSING_LEASE_MS = 15 * 60 * 1000;
const MANUAL_MEMBER_IMPORT_REISSUE_KEY_PREFIX = "manual-member-import-reissue:";
const MANUAL_MEMBER_IMPORT_REISSUE_INTERRUPTED_MESSAGE = "새 초기 설정 링크 발급이 중단되었습니다. 수신 여부를 확인한 뒤 새 링크 발급을 다시 진행해 주세요.";

type ImportBatchRow = {
  id: string;
  created_by_admin_id: string;
  status: "staging" | "ready" | "processing" | "completed" | "expired";
  expires_at: string;
  updated_at: string;
};

type ImportRow = {
  id: string;
  batch_id: string;
  status: "staged" | "processing" | "created" | "failed";
  member_id: string | null;
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
  image_upload_id: string | null;
  photo_sha256: string | null;
  photo_width: number | null;
  photo_height: number | null;
  photo_attached_at: string | null;
  delivery_channel: "mattermost" | "email" | null;
  delivery_attempted_at: string | null;
  delivery_sent_at: string | null;
  delivery_idempotency_key: string | null;
  staging_deleted_at: string | null;
  error_code: string | null;
  error_message: string | null;
  updated_at: string;
};

type ResolvedMattermostMember = {
  displayName: string;
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
    };

export type ManualMemberImportCommitItem = {
  rowNumber: number;
  status: "success" | "failed" | "already_exists";
  name: string | null;
  mmId: string | null;
  email: string | null;
  deliveryChannel: "mattermost" | "email" | null;
  reason: string | null;
  retryable: boolean;
  existingMemberId: string | null;
};

export type ManualMemberImportCommitResult = {
  batchId: string;
  total: number;
  success: number;
  failed: number;
  alreadyExists: number;
  retryableFailures: number;
  items: ManualMemberImportCommitItem[];
};

function toErrors(messages: Array<{ rowNumber: number | null; message: string }>) {
  return messages.map((item) =>
    item.rowNumber === null ? item.message : `${item.rowNumber}행: ${item.message}`,
  );
}

function buildSetupUrl(token: string) {
  const url = new URL("/auth/member/setup", SITE_URL);
  // Fragment values are not sent in request paths or Referer headers.
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
}

async function buildManualMemberSetupMattermostMessage(input: {
  displayName: string;
  setupUrl: string;
}) {
  const template = await resolveNotificationTemplate("mattermost.manual_member_setup");
  const variables = {
    siteName: SITE_NAME,
    displayName: input.displayName || "회원",
    setupUrl: input.setupUrl,
  };
  return [
    renderNotificationTemplate(template.titleTemplate, variables),
    renderNotificationTemplate(template.bodyTemplate, variables),
  ].join("\n\n");
}

async function sendSetupEmail(input: {
  email: string;
  displayName: string;
  token: string;
  reset: boolean;
  idempotencyKey?: string;
}) {
  const smtpConfig = getSmtpConfig();
  const transport = createSmtpTransport(smtpConfig);
  const setupUrl = buildSetupUrl(input.token);
  const template = await resolveNotificationTemplate(
    input.reset
      ? "email.manual_member_password_reset"
      : "email.manual_member_setup",
  );
  const variables = {
    siteName: SITE_NAME,
    displayName: input.displayName || "회원",
    setupUrl,
  };
  const subject = renderNotificationTemplate(template.titleTemplate, variables);
  const renderedBody = renderEmailTemplateBody(template.bodyTemplate, template.bodyFormat, variables);
  await transport.sendMail({
    from: `${SITE_NAME} <${smtpConfig.fromEmail}>`,
    to: input.email,
    subject,
    // Message-ID is correlation metadata only; SMTP delivery safety is handled
    // by the durable attempt checkpoint below, not by this header.
    messageId: input.idempotencyKey
      ? getManualMemberImportEmailMessageId(input.idempotencyKey)
      : undefined,
    text: renderedBody.text,
    html: renderedBody.html,
  });
}

function getManualMemberImportTokenSecret() {
  const secret = process.env.MANUAL_MEMBER_IMPORT_TOKEN_SECRET
    ?? process.env.USER_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("수동 회원 가져오기 토큰 비밀값이 필요합니다.");
  }
  return secret;
}

function getManualMemberImportSetupToken(rowId: string) {
  return createHmacDigest(
    `manual-member-import-setup:${rowId}`,
    getManualMemberImportTokenSecret(),
    "hex",
  );
}

function getManualMemberImportDeliveryIdempotencyKey(rowId: string) {
  return `manual-member-import-setup:${rowId}`;
}

function getManualMemberImportReissueIdempotencyKey(rowId: string) {
  return `${MANUAL_MEMBER_IMPORT_REISSUE_KEY_PREFIX}${rowId}:${randomUUID()}`;
}

function getManualMemberImportEmailMessageId(idempotencyKey: string) {
  if (!/^manual-member-import-(?:setup:[0-9a-f-]{36}|reissue:[0-9a-f-]{36}:[0-9a-f-]{36})$/.test(idempotencyKey)) {
    throw new Error("수동 회원 가져오기 이메일 키를 확인하지 못했습니다.");
  }
  return `<${idempotencyKey.replace(":", "-")}@ssartnership.local>`;
}

class ManualMemberImportDeliveryOutcomeUnknownError extends Error {
  constructor() {
    super("설정 링크 전송 결과를 확인해야 하므로 자동 재시도할 수 없습니다.");
  }
}

class ManualMemberImportExistingMemberError extends Error {
  readonly memberId: string;

  constructor(memberId: string) {
    super("이미 등록된 회원입니다.");
    this.name = "ManualMemberImportExistingMemberError";
    this.memberId = memberId;
  }
}

function getSafeFailureMessage(error: unknown) {
  if (error instanceof ManualMemberImportDeliveryOutcomeUnknownError) {
    return error.message;
  }
  if (!(error instanceof Error)) return "회원 생성에 실패했습니다.";
  if (/^(XLSX|회원 가져오기|기수|이름|캠퍼스|MM ID|이메일|사진 파일명|사진 목록|사진 ZIP|한 번에|가져올 회원 행)/.test(error.message)) {
    return error.message;
  }
  if (/duplicate|already|exists/i.test(error.message)) return "이미 활성화된 MM ID 또는 이메일입니다.";
  if (/photo|사진/i.test(error.message)) return "사진을 처리하지 못했습니다.";
  if (/mattermost|MM/i.test(error.message)) return "Mattermost 조회 또는 알림에 실패했습니다.";
  if (/email|SMTP/i.test(error.message)) return "이메일 알림을 보낼 수 없습니다.";
  return "회원 생성에 실패했습니다.";
}

function isSupportedImageContentType(value: string | null): value is (typeof MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES)[number] {
  return Boolean(value && MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES.includes(value as (typeof MANUAL_MEMBER_IMPORT_IMAGE_CONTENT_TYPES)[number]));
}

async function resolveMattermostMember(input: {
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

type ManualMemberImportReissueMember = {
  id: string;
  display_name: string | null;
  mattermost_account_id: string | null;
  email_normalized: string | null;
  generation: number | null;
  staff_source_generation: number | null;
  must_change_password: boolean;
};

async function resolveManualMemberImportReissueMember(input: {
  memberId: string;
}): Promise<ManualMemberImportReissueMember> {
  const { data, error } = await getSupabaseAdminClient()
    .from("members")
    .select("id,display_name,mattermost_account_id,email_normalized,generation,staff_source_generation,must_change_password")
    .eq("id", input.memberId)
    .is("deleted_at", null)
    .maybeSingle();
  const member = (data as ManualMemberImportReissueMember | null) ?? null;
  if (error || !member || !member.must_change_password) {
    throw new Error("초기 설정 링크를 발급할 수 있는 회원 상태가 아닙니다.");
  }
  return member;
}

async function resolveManualMemberImportReissueMattermostRecipient(input: {
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

async function resolveManualMemberImportReissueEmailRecipient(input: {
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

async function createManualInitialSetupReissueAction(input: {
  memberId: string;
  deliveryChannel: "mattermost" | "email";
}) {
  const token = generateOpaqueToken();
  const { data, error } = await getSupabaseAdminClient().rpc(
    "reissue_manual_member_initial_setup",
    {
      p_member_id: input.memberId,
      p_delivery_channel: input.deliveryChannel,
      p_token_hash: hashOpaqueToken(token),
      p_expires_at: new Date(Date.now() + PASSWORD_ACTION_TTL_MS).toISOString(),
    },
  );
  if (error || data !== input.memberId) {
    throw new Error("초기 설정 링크를 발급할 수 있는 회원 상태가 아닙니다.");
  }
  return token;
}

type ActiveManualPasswordAction = {
  id: string;
  token_hash: string;
};

async function findActiveManualPasswordAction(memberId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("member_password_action_tokens")
    .select("id,token_hash")
    .eq("member_id", memberId)
    .eq("purpose", "manual_initial_setup")
    .is("consumed_at", null)
    .maybeSingle();
  if (error) throw new Error("기존 설정 링크를 확인하지 못했습니다.");
  return (data as ActiveManualPasswordAction | null) ?? null;
}

async function ensureManualMemberImportPasswordAction(input: {
  memberId: string;
  rowId: string;
  deliveryChannel: "mattermost" | "email";
}) {
  const token = getManualMemberImportSetupToken(input.rowId);
  const tokenHash = hashOpaqueToken(token);
  const existing = await findActiveManualPasswordAction(input.memberId);
  if (existing) {
    if (existing.token_hash !== tokenHash) {
      throw new Error("기존 설정 링크가 있어 수동 가져오기를 재개할 수 없습니다.");
    }
    const { error } = await getSupabaseAdminClient()
      .from("member_password_action_tokens")
      .update({ delivery_channel: input.deliveryChannel })
      .eq("id", existing.id);
    if (error) throw new Error("설정 링크 전달 경로를 저장하지 못했습니다.");
    return token;
  }

  const { error: insertError } = await getSupabaseAdminClient()
    .from("member_password_action_tokens")
    .insert({
      member_id: input.memberId,
      purpose: "manual_initial_setup",
      delivery_channel: input.deliveryChannel,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + PASSWORD_ACTION_TTL_MS).toISOString(),
    });
  if (!insertError) return token;

  const claimedByConcurrentWorker = await findActiveManualPasswordAction(input.memberId);
  if (claimedByConcurrentWorker?.token_hash === tokenHash) return token;
  throw new Error("비밀번호 설정 링크를 준비하지 못했습니다.");
}

async function removeStagingFile(
  row: Pick<ImportRow, "staging_bucket" | "staging_path">,
) {
  if (row.staging_bucket && row.staging_path) {
    await removeGraduateStoredObject(row.staging_bucket, row.staging_path);
  }
}

type ManualImportProfileImage = {
  id: string;
  member_id: string | null;
};

async function findManualImportProfileImage(rowId: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("member_profile_images")
    .select("id,member_id")
    .eq("manual_member_import_row_id", rowId)
    .maybeSingle();
  if (error) throw new Error("사진 검토 요청 상태를 확인하지 못했습니다.");
  return (data as ManualImportProfileImage | null) ?? null;
}

async function attachPendingPhoto(memberId: string, row: ImportRow) {
  if (!row.staging_bucket || !row.staging_path) {
    return false;
  }
  const existingImage = await findManualImportProfileImage(row.id);
  if (existingImage) {
    if (existingImage.member_id !== memberId) {
      throw new Error("사진 검토 요청의 회원 연결을 확인하지 못했습니다.");
    }
    return true;
  }
  if (row.image_upload_id) {
    if (
      row.staging_bucket !== MEMBER_PROFILE_IMAGES_BUCKET
      || !row.photo_sha256
      || row.photo_width !== 640
      || row.photo_height !== 640
    ) {
      throw new Error("공통 사진 업로드 상태를 확인하지 못했습니다.");
    }
    const { data: image, error: insertError } = await getSupabaseAdminClient()
      .from("member_profile_images")
      .insert({
        member_id: memberId,
        storage_path: row.staging_path,
        sha256: row.photo_sha256,
        content_type: "image/webp",
        width: row.photo_width,
        height: row.photo_height,
        source: "manual_admin",
        status: "pending",
        manual_member_import_row_id: row.id,
      })
      .select("id")
      .single();
    if (!insertError && image?.id) return true;
    const concurrentImage = await findManualImportProfileImage(row.id);
    if (concurrentImage?.member_id === memberId) return true;
    throw new Error("사진 검토 요청을 저장하지 못했습니다.");
  }
  if (!isSupportedImageContentType(row.photo_content_type)) {
    return false;
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
    variant: `manual-import-${row.id}`,
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
      manual_member_import_row_id: row.id,
    })
    .select("id")
    .single();
  if (!insertError && image?.id) return true;
  const concurrentImage = await findManualImportProfileImage(row.id);
  if (concurrentImage?.member_id === memberId) return true;
  if (!concurrentImage) {
    await removeGraduateStoredObject(MEMBER_PROFILE_IMAGES_BUCKET, storagePath).catch(() => undefined);
  }
  throw new Error("사진 검토 요청을 저장하지 못했습니다.");
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
    });
    const photoResult = validateManualMemberImportPhotoManifest(
      rowsResult.acceptedRows,
      input.photos,
      { requireUploadIds: true },
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
    const imageUploadRepository = getImageUploadRepository();
    const insertRows = await Promise.all(rowsResult.acceptedRows.map(async (row) => {
      const photo = row.photoFilename
        ? photoByFilename.get(row.photoFilename.toLowerCase()) ?? null
        : null;
      const rowId = randomUUID();
      if (photo) {
        if (!photo.uploadId) {
          throw new Error("사진 업로드 정보를 확인해 주세요.");
        }
        const attached = await imageUploadRepository.attach({
          actor: { kind: "admin", id: input.adminId },
          purpose: "manual-member-import",
          uploadId: photo.uploadId,
          role: "profile",
          policy: resolveImageTransformPolicy("manual-member-import", "profile"),
          destination: {
            bucket: MEMBER_PROFILE_IMAGES_BUCKET,
            path: `manual-import/uploads/${photo.uploadId}.webp`,
            isPublic: false,
            cacheControl: "private, no-store",
          },
          resource: { type: "manual_member_import_row", id: rowId },
        });
        return {
          id: rowId,
          batch_id: batch.id,
          row_number: row.rowNumber,
          generation: row.generation,
          display_name: row.name,
          campus: row.campus,
          mm_username: row.mmId,
          email: row.email,
          email_normalized: row.email,
          photo_filename: row.photoFilename,
          staging_bucket: MEMBER_PROFILE_IMAGES_BUCKET,
          staging_path: attached.path,
          photo_content_type: "image/webp",
          photo_size_bytes: null,
          image_upload_id: photo.uploadId,
          photo_sha256: attached.sha256,
          photo_width: attached.width,
          photo_height: attached.height,
        };
      }
      return {
        id: rowId,
        batch_id: batch.id,
        row_number: row.rowNumber,
        generation: row.generation,
        display_name: row.name,
        campus: row.campus,
        mm_username: row.mmId,
        email: row.email,
        email_normalized: row.email,
        photo_filename: row.photoFilename,
        staging_bucket: null,
        staging_path: null,
        photo_content_type: null,
        photo_size_bytes: null,
      };
    }));
    const { error: rowsError } = await supabase
      .from("manual_member_import_rows")
      .insert(insertRows);
    if (rowsError) {
      await supabase.from("manual_member_import_batches").delete().eq("id", batch.id);
      throw new Error("가져오기 행을 저장하지 못했습니다.");
    }
    await supabase.from("manual_member_import_batches").update({ status: "ready" }).eq("id", batch.id);
    return { ok: true, batchId: batch.id as string, expiresAt };
  } catch (error) {
    return { ok: false, errors: [getSafeFailureMessage(error)] };
  }
}

type ImportRowLease = {
  id: string;
  updated_at: string;
};

type ImportMemberCheckpoint = {
  memberId: string;
  rowLeaseVersion: string;
};

async function findExistingManualMemberImportMemberId(input: {
  mattermostAccountId?: string | null;
  mmUsername?: string | null;
  emailNormalized?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  let mattermostAccountId = input.mattermostAccountId ?? null;

  if (!mattermostAccountId && input.mmUsername) {
    const { data: directory, error: directoryError } = await supabase
      .from("mm_user_directory")
      .select("id")
      .eq("mm_username", input.mmUsername)
      .eq("is_active", true)
      .maybeSingle();
    if (directoryError) {
      throw new Error("기존 Mattermost 회원 정보를 불러오지 못했습니다.");
    }
    mattermostAccountId = typeof directory?.id === "string" ? directory.id : null;
  }

  if (mattermostAccountId) {
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id")
      .eq("mattermost_account_id", mattermostAccountId)
      .is("deleted_at", null)
      .maybeSingle();
    if (memberError) {
      throw new Error("기존 회원 정보를 불러오지 못했습니다.");
    }
    if (typeof member?.id === "string") return member.id;
  }

  if (input.emailNormalized) {
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id")
      .eq("email_normalized", input.emailNormalized)
      .is("deleted_at", null)
      .maybeSingle();
    if (memberError) {
      throw new Error("기존 회원 정보를 불러오지 못했습니다.");
    }
    if (typeof member?.id === "string") return member.id;
  }

  return null;
}

async function claimManualMemberImportRow(row: ImportRow): Promise<ImportRowLease | null> {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({
      status: "processing",
      error_code: null,
      error_message: null,
    })
    .eq("id", row.id)
    .eq("batch_id", row.batch_id)
    .in("status", ["staged", "failed"])
    .select("id,updated_at")
    .maybeSingle();
  if (error) throw new Error("가져오기 행을 선점하지 못했습니다.");
  return (data as ImportRowLease | null) ?? null;
}

async function checkpointManualMemberImportMember(input: {
  row: ImportRow;
  rowLeaseVersion: string;
  displayName: string;
  campus: string;
  mattermostAccountId: string | null;
  staffSourceGeneration: number | null;
}): Promise<ImportMemberCheckpoint> {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "checkpoint_manual_member_import_member",
    {
      p_row_id: input.row.id,
      p_batch_id: input.row.batch_id,
      p_expected_row_updated_at: input.rowLeaseVersion,
      p_display_name: input.displayName,
      p_generation: input.row.generation,
      p_staff_source_generation: input.staffSourceGeneration,
      p_campus: input.campus,
      p_mattermost_account_id: input.mattermostAccountId,
      p_email: input.row.email_normalized,
      p_email_normalized: input.row.email_normalized,
    },
  );
  if (error) {
    const duplicateKind = getManualMemberImportDuplicateKind(error);
    if (duplicateKind) {
      const existingMemberId = await findExistingManualMemberImportMemberId({
        mattermostAccountId: duplicateKind === "mattermost"
          ? input.mattermostAccountId
          : null,
        emailNormalized: duplicateKind === "email" ? input.row.email_normalized : null,
      });
      if (existingMemberId) {
        throw new ManualMemberImportExistingMemberError(existingMemberId);
      }
    }
    throw new Error("회원 정보를 저장하지 못했습니다.");
  }
  const checkpoint = (
    data as Array<{ member_id: string; row_updated_at: string }> | null
  )?.[0] ?? null;
  if (!checkpoint?.member_id || !checkpoint.row_updated_at) {
    throw new Error("회원 정보를 저장하지 못했습니다.");
  }
  return {
    memberId: checkpoint.member_id,
    rowLeaseVersion: checkpoint.row_updated_at,
  };
}

type ImportRowCheckpoint = {
  rowLeaseVersion: string;
};

async function checkpointManualMemberImportPhotoAttachment(input: {
  row: ImportRow;
  rowLeaseVersion: string;
}): Promise<ImportRowCheckpoint> {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({ photo_attached_at: new Date().toISOString() })
    .eq("id", input.row.id)
    .eq("batch_id", input.row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", input.rowLeaseVersion)
    .select("updated_at")
    .maybeSingle();
  const checkpoint = (data as Pick<ImportRowLease, "updated_at"> | null) ?? null;
  if (error || !checkpoint) {
    throw new Error("사진 검토 요청 상태를 저장하지 못했습니다.");
  }
  return { rowLeaseVersion: checkpoint.updated_at };
}

type ImportRowDeliveryIntent = ImportRowCheckpoint & {
  deliveryIdempotencyKey: string;
};

async function checkpointManualMemberImportDeliveryIntent(input: {
  row: ImportRow;
  rowLeaseVersion: string;
  deliveryChannel: "mattermost" | "email";
  deliveryIdempotencyKey: string;
}): Promise<ImportRowDeliveryIntent> {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({
      delivery_channel: input.deliveryChannel,
      delivery_idempotency_key: input.deliveryIdempotencyKey,
    })
    .eq("id", input.row.id)
    .eq("batch_id", input.row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", input.rowLeaseVersion)
    .select("updated_at")
    .maybeSingle();
  const checkpoint = (data as Pick<ImportRowLease, "updated_at"> | null) ?? null;
  if (error || !checkpoint) {
    throw new Error("설정 링크 전달 상태를 저장하지 못했습니다.");
  }
  return {
    rowLeaseVersion: checkpoint.updated_at,
    deliveryIdempotencyKey: input.deliveryIdempotencyKey,
  };
}

async function checkpointManualMemberImportDeliveryAttempt(input: {
  row: ImportRow;
  rowLeaseVersion: string;
  deliveryChannel: "mattermost" | "email";
  deliveryIdempotencyKey: string;
}): Promise<ImportRowCheckpoint> {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({
      delivery_channel: input.deliveryChannel,
      delivery_idempotency_key: input.deliveryIdempotencyKey,
      delivery_attempted_at: new Date().toISOString(),
    })
    .eq("id", input.row.id)
    .eq("batch_id", input.row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", input.rowLeaseVersion)
    .select("updated_at")
    .maybeSingle();
  const checkpoint = (data as Pick<ImportRowLease, "updated_at"> | null) ?? null;
  if (error || !checkpoint) {
    throw new Error("설정 링크 전송 시도를 저장하지 못했습니다.");
  }
  return { rowLeaseVersion: checkpoint.updated_at };
}

async function checkpointManualMemberImportDeliverySent(input: {
  row: ImportRow;
  rowLeaseVersion: string;
  deliveryChannel: "mattermost" | "email";
  deliveryIdempotencyKey: string;
}): Promise<ImportRowCheckpoint> {
  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({
      delivery_channel: input.deliveryChannel,
      delivery_idempotency_key: input.deliveryIdempotencyKey,
      delivery_sent_at: new Date().toISOString(),
    })
    .eq("id", input.row.id)
    .eq("batch_id", input.row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", input.rowLeaseVersion)
    .select("updated_at")
    .maybeSingle();
  const checkpoint = (data as Pick<ImportRowLease, "updated_at"> | null) ?? null;
  if (error || !checkpoint) {
    throw new Error("설정 링크 전송 상태를 저장하지 못했습니다.");
  }
  return { rowLeaseVersion: checkpoint.updated_at };
}

type ManualMemberImportDelivery = {
  deliveryChannel: "mattermost" | "email";
  rowLeaseVersion: string;
};

async function deliverManualMemberImportSetup(input: {
  row: ImportRow;
  memberId: string;
  displayName: string;
  resolvedMattermostMember: ResolvedMattermostMember | null;
  rowLeaseVersion: string;
  onRowLeaseUpdated: (rowLeaseVersion: string) => void;
}): Promise<ManualMemberImportDelivery> {
  let deliveryChannel = input.row.delivery_channel;
  const deliveryIdempotencyKey = input.row.delivery_idempotency_key
    ?? getManualMemberImportDeliveryIdempotencyKey(input.row.id);
  let currentRowLeaseVersion = input.rowLeaseVersion;

  async function checkpointDeliverySent(channel: "mattermost" | "email") {
    try {
      const sent = await checkpointManualMemberImportDeliverySent({
        row: input.row,
        rowLeaseVersion: currentRowLeaseVersion,
        deliveryChannel: channel,
        deliveryIdempotencyKey,
      });
      currentRowLeaseVersion = sent.rowLeaseVersion;
      input.onRowLeaseUpdated(currentRowLeaseVersion);
      return { deliveryChannel: channel, rowLeaseVersion: currentRowLeaseVersion };
    } catch {
      // The provider may already have accepted the message; do not reopen a
      // retry path unless a later provider status lookup can prove otherwise.
      throw new ManualMemberImportDeliveryOutcomeUnknownError();
    }
  }

  if (input.row.delivery_sent_at) {
    if (!deliveryChannel || !input.row.delivery_idempotency_key) {
      throw new Error("설정 링크 전송 체크포인트를 확인하지 못했습니다.");
    }
    return { deliveryChannel, rowLeaseVersion: currentRowLeaseVersion };
  }

  const initialDeliveryChannel = deliveryChannel
    ?? (input.resolvedMattermostMember ? "mattermost" : "email");
  if (
    deliveryChannel !== initialDeliveryChannel
    || input.row.delivery_idempotency_key !== deliveryIdempotencyKey
  ) {
    const intent = await checkpointManualMemberImportDeliveryIntent({
      row: input.row,
      rowLeaseVersion: currentRowLeaseVersion,
      deliveryChannel: initialDeliveryChannel,
      deliveryIdempotencyKey,
    });
    deliveryChannel = initialDeliveryChannel;
    currentRowLeaseVersion = intent.rowLeaseVersion;
    input.onRowLeaseUpdated(currentRowLeaseVersion);
  }

  if (deliveryChannel !== "mattermost" && deliveryChannel !== "email") {
    throw new Error("계정 설정 링크를 전달할 수 없습니다.");
  }

  if (input.row.delivery_attempted_at) {
    // Mattermost direct posts and SMTP do not expose a durable provider-side
    // idempotency/status lookup. A retry could send a second setup link.
    throw new ManualMemberImportDeliveryOutcomeUnknownError();
  }

  if (deliveryChannel === "mattermost") {
    const recipient = input.resolvedMattermostMember;
    if (!recipient) {
      throw new Error("MM 계정 설정 알림 대상을 확인하지 못했습니다.");
    }
    const setupToken = await ensureManualMemberImportPasswordAction({
      memberId: input.memberId,
      rowId: input.row.id,
      deliveryChannel,
    });
    const attempted = await checkpointManualMemberImportDeliveryAttempt({
      row: input.row,
      rowLeaseVersion: currentRowLeaseVersion,
      deliveryChannel,
      deliveryIdempotencyKey,
    });
    currentRowLeaseVersion = attempted.rowLeaseVersion;
    input.onRowLeaseUpdated(currentRowLeaseVersion);

    try {
      const setupUrl = buildSetupUrl(setupToken);
      const message = await buildManualMemberSetupMattermostMessage({
        displayName: input.displayName,
        setupUrl,
      });
      await withActiveMattermostSenderForGeneration(
        recipient.resolvedGeneration,
        (session) => session.sendDirectMessage(
          recipient.mattermostUserId,
          message,
        ),
      );
    } catch {
      throw new ManualMemberImportDeliveryOutcomeUnknownError();
    }
    return checkpointDeliverySent("mattermost");
  }

  if (!input.row.email_normalized) {
    throw new Error("계정 설정 링크를 전달할 수 없습니다.");
  }
  // Validate static configuration before recording an attempt. Any later SMTP
  // error is intentionally treated as an unknown outcome and is not resent.
  getSmtpConfig();
  const setupToken = await ensureManualMemberImportPasswordAction({
    memberId: input.memberId,
    rowId: input.row.id,
    deliveryChannel,
  });
  const attempted = await checkpointManualMemberImportDeliveryAttempt({
    row: input.row,
    rowLeaseVersion: currentRowLeaseVersion,
    deliveryChannel,
    deliveryIdempotencyKey,
  });
  currentRowLeaseVersion = attempted.rowLeaseVersion;
  input.onRowLeaseUpdated(currentRowLeaseVersion);
  try {
    await sendSetupEmail({
      email: input.row.email_normalized,
      displayName: input.displayName,
      token: setupToken,
      reset: false,
      idempotencyKey: deliveryIdempotencyKey,
    });
  } catch {
    throw new ManualMemberImportDeliveryOutcomeUnknownError();
  }
  return checkpointDeliverySent("email");
}

async function processImportRow(
  row: ImportRow,
  rowLeaseVersion: string,
  onRowLeaseUpdated: (rowLeaseVersion: string) => void,
): Promise<ManualMemberImportCommitItem> {
  const supabase = getSupabaseAdminClient();
  let currentRowLeaseVersion = rowLeaseVersion;
  const item = {
    rowNumber: row.row_number,
    name: row.display_name,
    mmId: row.mm_username,
    email: row.email_normalized,
  };
  try {
    const resolvedMattermostMember = row.mm_username
      ? await resolveMattermostMember({
          mmUsername: row.mm_username,
          generation: row.generation,
        })
      : null;
    const displayName = resolvedMattermostMember?.displayName ?? row.display_name;
    const campus = row.campus;
    if (!displayName || !campus) throw new Error("회원 프로필 정보가 부족합니다.");
    const checkpoint = await checkpointManualMemberImportMember({
      row,
      rowLeaseVersion: currentRowLeaseVersion,
      displayName,
      campus,
      mattermostAccountId: resolvedMattermostMember?.mattermostAccountId ?? null,
      staffSourceGeneration: row.generation === 0
        ? resolvedMattermostMember?.resolvedGeneration ?? null
        : null,
    });
    const memberId = checkpoint.memberId;
    currentRowLeaseVersion = checkpoint.rowLeaseVersion;
    onRowLeaseUpdated(currentRowLeaseVersion);
    if (!row.photo_attached_at && await attachPendingPhoto(memberId, row)) {
      const photoCheckpoint = await checkpointManualMemberImportPhotoAttachment({
        row,
        rowLeaseVersion: currentRowLeaseVersion,
      });
      currentRowLeaseVersion = photoCheckpoint.rowLeaseVersion;
      onRowLeaseUpdated(currentRowLeaseVersion);
    }
    const delivery = await deliverManualMemberImportSetup({
      row,
      memberId,
      displayName,
      resolvedMattermostMember,
      rowLeaseVersion: currentRowLeaseVersion,
      onRowLeaseUpdated: (updatedRowLeaseVersion) => {
        currentRowLeaseVersion = updatedRowLeaseVersion;
        onRowLeaseUpdated(updatedRowLeaseVersion);
      },
    });
    currentRowLeaseVersion = delivery.rowLeaseVersion;
    onRowLeaseUpdated(currentRowLeaseVersion);
    const { data: completedRow, error: completedRowError } = await supabase
      .from("manual_member_import_rows")
      .update({
        member_id: memberId,
        status: "created",
        delivery_channel: delivery.deliveryChannel,
        error_code: null,
        error_message: null,
      })
      .eq("id", row.id)
      .eq("batch_id", row.batch_id)
      .eq("status", "processing")
      .eq("updated_at", currentRowLeaseVersion)
      .select("id")
      .maybeSingle();
    if (completedRowError || !completedRow) {
      throw new Error("회원 가져오기 행 처리 권한이 만료되었습니다.");
    }
    return {
      ...item,
      name: displayName,
      status: "success",
      deliveryChannel: delivery.deliveryChannel,
      reason: null,
      retryable: false,
      existingMemberId: null,
    };
  } catch (error) {
    const existingMemberId = error instanceof ManualMemberImportExistingMemberError
      ? error.memberId
      : null;
    const reason = existingMemberId ? "이미 등록된 회원입니다." : getSafeFailureMessage(error);
    const retryable = !existingMemberId
      && !(error instanceof ManualMemberImportDeliveryOutcomeUnknownError);
    const { data: failedRow, error: failedRowError } = await supabase
      .from("manual_member_import_rows")
      .update({
        status: "failed",
        error_code: existingMemberId
          ? "already_registered"
          : retryable ? "member_create_failed" : "delivery_outcome_unknown",
        error_message: reason,
      })
      .eq("id", row.id)
      .eq("batch_id", row.batch_id)
      .eq("status", "processing")
      .eq("updated_at", currentRowLeaseVersion)
      .select("id")
      .maybeSingle();
    if (failedRowError || !failedRow) {
      throw new Error("회원 가져오기 행 처리 권한이 만료되었습니다.");
    }
    return {
      ...item,
      status: existingMemberId ? "already_exists" : "failed",
      deliveryChannel: row.delivery_channel,
      reason,
      retryable,
      existingMemberId,
    };
  }
}

type ManualMemberImportResultRow = Pick<
  ImportRow,
  | "row_number"
  | "status"
  | "display_name"
  | "mm_username"
  | "email_normalized"
  | "delivery_channel"
  | "error_code"
  | "error_message"
>;

function isRetryableManualMemberImportRow(
  row: Pick<ImportRow, "status" | "error_code">,
) {
  return row.status === "staged"
    || (row.status === "failed"
      && row.error_code !== "delivery_outcome_unknown"
      && row.error_code !== "already_registered");
}

async function toManualMemberImportCommitItem(
  row: ManualMemberImportResultRow,
): Promise<ManualMemberImportCommitItem> {
  const success = row.status === "created";
  const existingMemberId = row.error_code === "already_registered"
    ? await findExistingManualMemberImportMemberId({
        mmUsername: row.mm_username,
        emailNormalized: row.email_normalized,
      })
    : null;
  const alreadyExists = row.error_code === "already_registered";
  const retryable = !success && !alreadyExists && isRetryableManualMemberImportRow(row);
  return {
    rowNumber: row.row_number,
    status: success ? "success" : alreadyExists ? "already_exists" : "failed",
    name: row.display_name,
    mmId: row.mm_username,
    email: row.email_normalized,
    deliveryChannel: row.delivery_channel,
    reason: success
      ? null
      : alreadyExists
        ? "이미 등록된 회원입니다."
        : row.error_message ?? (retryable ? "처리 대기 중입니다." : "전송 결과 확인이 필요합니다."),
    retryable,
    existingMemberId,
  };
}

export async function commitManualMemberImport(input: {
  adminId: string;
  batchId: string;
}): Promise<ManualMemberImportCommitResult> {
  const supabase = getSupabaseAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const processingLeaseExpiredAt = new Date(
    now.getTime() - PROCESSING_LEASE_MS,
  ).toISOString();
  const { data: batchData, error: batchError } = await supabase
    .from("manual_member_import_batches")
    .select("id,created_by_admin_id,status,expires_at,updated_at")
    .eq("id", input.batchId)
    .eq("created_by_admin_id", input.adminId)
    .maybeSingle();
  const batch = (batchData as ImportBatchRow | null) ?? null;
  if (batchError || !batch || new Date(batch.expires_at).getTime() <= now.getTime()) {
    throw new Error("가져오기 배치가 없거나 만료되었습니다.");
  }
  const isReady = batch.status === "ready";
  const isExpiredProcessingLease = batch.status === "processing"
    && new Date(batch.updated_at).getTime() < new Date(processingLeaseExpiredAt).getTime();
  if (!isReady && !isExpiredProcessingLease) {
    throw new Error("가져오기 배치가 준비 상태가 아닙니다.");
  }

  const claim = isReady
    ? supabase
      .from("manual_member_import_batches")
      .update({ status: "processing" })
      .eq("id", input.batchId)
      .eq("created_by_admin_id", input.adminId)
      .eq("status", "ready")
      .gt("expires_at", nowIso)
    : supabase
      .from("manual_member_import_batches")
      .update({ status: "processing" })
      .eq("id", input.batchId)
      .eq("created_by_admin_id", input.adminId)
      .eq("status", "processing")
      .lt("updated_at", processingLeaseExpiredAt)
      .gt("expires_at", nowIso);
  const { data: claimedBatchData, error: claimError } = await claim
    .select("id,updated_at")
    .maybeSingle();
  const claimedBatch = (
    claimedBatchData as Pick<ImportBatchRow, "id" | "updated_at"> | null
  ) ?? null;
  if (claimError || !claimedBatch) {
    throw new Error("가져오기 배치가 이미 처리 중이거나 준비 상태가 아닙니다.");
  }
  // `updated_at` is the conditional claim's lease token. A newer worker
  // invalidates an older worker before it can advance batch or row state.
  let processingLeaseVersion = claimedBatch.updated_at;
  // Rows are processed sequentially, so there can be at most one row lease
  // that needs recovery before this batch lease is released.
  let activeRowLease: ImportRowLease | null = null;

  async function hasProcessingLease() {
    const { data, error } = await supabase
      .from("manual_member_import_batches")
      .select("id")
      .eq("id", input.batchId)
      .eq("created_by_admin_id", input.adminId)
      .eq("status", "processing")
      .eq("updated_at", processingLeaseVersion)
      .maybeSingle();
    if (error) {
      throw new Error("가져오기 처리 상태를 확인하지 못했습니다.");
    }
    return Boolean(data);
  }

  async function assertProcessingLease() {
    if (!await hasProcessingLease()) {
      throw new Error("가져오기 처리 권한이 만료되었습니다.");
    }
  }

  async function refreshProcessingLease() {
    const { data, error } = await supabase
      .from("manual_member_import_batches")
      .update({ status: "processing" })
      .eq("id", input.batchId)
      .eq("created_by_admin_id", input.adminId)
      .eq("status", "processing")
      .eq("updated_at", processingLeaseVersion)
      .select("updated_at")
      .maybeSingle();
    const refreshedBatch = (
      data as Pick<ImportBatchRow, "updated_at"> | null
    ) ?? null;
    if (error || !refreshedBatch) {
      throw new Error("가져오기 처리 상태를 갱신하지 못했습니다.");
    }
    processingLeaseVersion = refreshedBatch.updated_at;
  }

  async function requeueActiveRow() {
    if (!activeRowLease) return;
    const { data, error } = await supabase
      .from("manual_member_import_rows")
      .update({
        status: "staged",
        error_code: null,
        error_message: null,
      })
      .eq("id", activeRowLease.id)
      .eq("batch_id", input.batchId)
      .eq("status", "processing")
      .eq("updated_at", activeRowLease.updated_at)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      throw new Error("가져오기 행을 복구하지 못했습니다.");
    }
  }

  async function releaseProcessingLease() {
    const { data, error } = await supabase
      .from("manual_member_import_batches")
      .update({ status: "ready" })
      .eq("id", input.batchId)
      .eq("created_by_admin_id", input.adminId)
      .eq("status", "processing")
      .eq("updated_at", processingLeaseVersion)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      throw new Error("가져오기 처리 상태를 복구하지 못했습니다.");
    }
  }

  async function cleanupCreatedManualMemberImportStagingFiles() {
    await assertProcessingLease();
    const { data, error } = await supabase
      .from("manual_member_import_rows")
      .select("id,batch_id,staging_bucket,staging_path,image_upload_id")
      .eq("batch_id", input.batchId)
      .eq("status", "created")
      .is("staging_deleted_at", null)
      .order("row_number");
    if (error) throw new Error("완료된 가져오기 행의 사진을 확인하지 못했습니다.");

    for (const row of (data ?? []) as Array<Pick<
      ImportRow,
      "id" | "batch_id" | "staging_bucket" | "staging_path" | "image_upload_id"
    >>) {
      await assertProcessingLease();
      if (!row.image_upload_id) {
        await removeStagingFile(row);
      }
      const { data: cleanedRow, error: cleanupError } = await supabase
        .from("manual_member_import_rows")
        .update({ staging_deleted_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("batch_id", row.batch_id)
        .eq("status", "created")
        .is("staging_deleted_at", null)
        .select("id")
        .maybeSingle();
      if (cleanupError || !cleanedRow) {
        throw new Error("완료된 가져오기 사진을 정리하지 못했습니다.");
      }
    }
  }

  try {
    if (isExpiredProcessingLease) {
      await assertProcessingLease();
      const { error: requeueRowsError } = await supabase
        .from("manual_member_import_rows")
        .update({
          status: "staged",
          error_code: null,
          error_message: null,
        })
        .eq("batch_id", input.batchId)
        .eq("status", "processing");
      if (requeueRowsError) {
        throw new Error("중단된 가져오기 행을 복구하지 못했습니다.");
      }
    }
    const { data: rowsData, error: rowsError } = await supabase
      .from("manual_member_import_rows")
      .select("id,batch_id,status,member_id,row_number,generation,display_name,campus,mm_username,email,email_normalized,photo_filename,staging_bucket,staging_path,photo_content_type,photo_size_bytes,image_upload_id,photo_sha256,photo_width,photo_height,photo_attached_at,delivery_channel,delivery_attempted_at,delivery_sent_at,delivery_idempotency_key,staging_deleted_at,error_code,error_message,updated_at")
      .eq("batch_id", input.batchId)
      .in("status", ["staged", "failed"])
      .order("row_number");
    if (rowsError) throw new Error("가져오기 행을 불러오지 못했습니다.");
    const retryableRows = ((rowsData ?? []) as ImportRow[])
      .filter(isRetryableManualMemberImportRow);
    if (retryableRows.length > 0) {
      for (const row of retryableRows) {
        await assertProcessingLease();
        const rowLease = await claimManualMemberImportRow(row);
        if (!rowLease) {
          throw new Error("가져오기 행을 선점하지 못했습니다.");
        }
        activeRowLease = rowLease;
        await assertProcessingLease();
        await processImportRow(
          row,
          rowLease.updated_at,
          (rowLeaseVersion) => {
            activeRowLease = { id: row.id, updated_at: rowLeaseVersion };
          },
        );
        activeRowLease = null;
        await refreshProcessingLease();
      }
    }
    await cleanupCreatedManualMemberImportStagingFiles();
    const { data: resultRowsData, error: resultRowsError } = await supabase
      .from("manual_member_import_rows")
      .select("row_number,status,display_name,mm_username,email_normalized,delivery_channel,error_code,error_message")
      .eq("batch_id", input.batchId)
      .order("row_number");
    if (resultRowsError) throw new Error("가져오기 결과를 불러오지 못했습니다.");
    const items = await Promise.all(
      ((resultRowsData ?? []) as ManualMemberImportResultRow[])
        .map(toManualMemberImportCommitItem),
    );
    const success = items.filter((item) => item.status === "success").length;
    const failed = items.filter((item) => item.status === "failed").length;
    const alreadyExists = items.filter((item) => item.status === "already_exists").length;
    const retryableFailures = items.filter((item) => item.status === "failed" && item.retryable).length;
    const nextBatchStatus = retryableFailures > 0 ? "ready" : "completed";
    const { data: completedBatch, error: completedError } = await supabase
      .from("manual_member_import_batches")
      .update({
        status: nextBatchStatus,
        completed_at: retryableFailures > 0 ? null : new Date().toISOString(),
      })
      .eq("id", input.batchId)
      .eq("status", "processing")
      .eq("created_by_admin_id", input.adminId)
      .eq("updated_at", processingLeaseVersion)
      .select("id")
      .maybeSingle();
    if (completedError || !completedBatch) {
      throw new Error("가져오기 결과 상태를 저장하지 못했습니다.");
    }
    return {
      batchId: input.batchId,
      total: items.length,
      success,
      failed,
      alreadyExists,
      retryableFailures,
      items,
    };
  } catch (error) {
    if (await hasProcessingLease()) {
      await requeueActiveRow();
      await releaseProcessingLease();
    }
    throw error;
  }
}

function isManualMemberImportReissueDeliveryKey(value: string | null) {
  return value?.startsWith(MANUAL_MEMBER_IMPORT_REISSUE_KEY_PREFIX) ?? false;
}

async function reclaimExpiredManualMemberImportReissueLease(input: {
  row: ImportRow;
  processingLeaseExpiredAt: string;
}): Promise<ImportRow | null> {
  if (
    input.row.status !== "processing"
    || !isManualMemberImportReissueDeliveryKey(input.row.delivery_idempotency_key)
  ) {
    return null;
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("manual_member_import_rows")
    .update({
      status: "failed",
      error_code: "delivery_outcome_unknown",
      error_message: MANUAL_MEMBER_IMPORT_REISSUE_INTERRUPTED_MESSAGE,
    })
    .eq("id", input.row.id)
    .eq("batch_id", input.row.batch_id)
    .eq("status", "processing")
    .eq("updated_at", input.row.updated_at)
    .lt("updated_at", input.processingLeaseExpiredAt)
    .like("delivery_idempotency_key", `${MANUAL_MEMBER_IMPORT_REISSUE_KEY_PREFIX}%`)
    .select("id,batch_id,status,member_id,row_number,generation,display_name,campus,mm_username,email,email_normalized,photo_filename,staging_bucket,staging_path,photo_content_type,photo_size_bytes,image_upload_id,photo_sha256,photo_width,photo_height,photo_attached_at,delivery_channel,delivery_attempted_at,delivery_sent_at,delivery_idempotency_key,staging_deleted_at,error_code,error_message,updated_at")
    .maybeSingle();
  if (error) {
    throw new Error("중단된 초기 설정 링크 발급을 복구하지 못했습니다.");
  }
  return (data as ImportRow | null) ?? null;
}

export async function reissueManualMemberImportSetup(input: {
  batchId: string;
  rowNumber: number;
}): Promise<ManualMemberImportCommitItem> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("manual_member_import_rows")
    .select("id,batch_id,status,member_id,row_number,generation,display_name,campus,mm_username,email,email_normalized,photo_filename,staging_bucket,staging_path,photo_content_type,photo_size_bytes,image_upload_id,photo_sha256,photo_width,photo_height,photo_attached_at,delivery_channel,delivery_attempted_at,delivery_sent_at,delivery_idempotency_key,staging_deleted_at,error_code,error_message,updated_at")
    .eq("batch_id", input.batchId)
    .eq("row_number", input.rowNumber)
    .maybeSingle();
  let row = (data as ImportRow | null) ?? null;
  if (error || !row) {
    throw new Error("새 초기 설정 링크를 발급할 수 있는 행이 아닙니다.");
  }

  if (row.status === "processing") {
    const processingLeaseExpiredAt = new Date(
      Date.now() - PROCESSING_LEASE_MS,
    ).toISOString();
    const recoveredRow = await reclaimExpiredManualMemberImportReissueLease({
      row,
      processingLeaseExpiredAt,
    });
    if (!recoveredRow) {
      throw new Error("새 초기 설정 링크 발급이 이미 처리 중입니다.");
    }
    row = recoveredRow;
  }

  if (
    row.status !== "failed"
    || row.error_code !== "delivery_outcome_unknown"
    || !row.member_id
    || !row.delivery_channel
  ) {
    throw new Error("새 초기 설정 링크를 발급할 수 있는 행이 아닙니다.");
  }

  if (row.delivery_channel === "email" && !row.email_normalized) {
    throw new Error("이메일 계정 설정 링크를 전달할 수 없습니다.");
  }
  if (row.delivery_channel === "email") {
    // Reject missing SMTP configuration before the row is claimed for delivery.
    getSmtpConfig();
  }

  const deliveryIdempotencyKey = getManualMemberImportReissueIdempotencyKey(row.id);
  const { data: claimedRowData, error: claimError } = await supabase
    .from("manual_member_import_rows")
    .update({
      status: "processing",
      error_code: null,
      error_message: null,
      delivery_attempted_at: null,
      delivery_sent_at: null,
      delivery_idempotency_key: deliveryIdempotencyKey,
    })
    .eq("id", row.id)
    .eq("batch_id", row.batch_id)
    .eq("status", "failed")
    .eq("error_code", "delivery_outcome_unknown")
    .eq("updated_at", row.updated_at)
    .select("updated_at")
    .maybeSingle();
  const claimedRow = (claimedRowData as Pick<ImportRowLease, "updated_at"> | null) ?? null;
  if (claimError || !claimedRow) {
    throw new Error("새 초기 설정 링크 발급이 이미 처리 중입니다.");
  }

  const processingRow: ImportRow = {
    ...row,
    status: "processing",
    delivery_attempted_at: null,
    delivery_sent_at: null,
    delivery_idempotency_key: deliveryIdempotencyKey,
    error_code: null,
    error_message: null,
    updated_at: claimedRow.updated_at,
  };
  let currentRowLeaseVersion = claimedRow.updated_at;

  try {
    const member = await resolveManualMemberImportReissueMember({
      memberId: row.member_id,
    });
    const mattermostRecipient = row.delivery_channel === "mattermost"
      ? await resolveManualMemberImportReissueMattermostRecipient({
          member,
          fallbackDisplayName: row.display_name,
        })
      : null;
    const emailRecipient = row.delivery_channel === "email"
      ? await resolveManualMemberImportReissueEmailRecipient({
          member,
          importEmailNormalized: row.email_normalized,
          fallbackDisplayName: row.display_name,
        })
      : null;
    const displayName = mattermostRecipient?.displayName
      ?? emailRecipient?.displayName
      ?? row.display_name
      ?? "회원";
    const setupToken = await createManualInitialSetupReissueAction({
      memberId: row.member_id,
      deliveryChannel: row.delivery_channel,
    });
    const attempted = await checkpointManualMemberImportDeliveryAttempt({
      row: processingRow,
      rowLeaseVersion: currentRowLeaseVersion,
      deliveryChannel: row.delivery_channel,
      deliveryIdempotencyKey,
    });
    currentRowLeaseVersion = attempted.rowLeaseVersion;

    if (row.delivery_channel === "mattermost") {
      if (!mattermostRecipient) {
        throw new Error("회원의 연결된 MM 계정을 확인하지 못했습니다.");
      }
      try {
        const setupUrl = buildSetupUrl(setupToken);
        const message = await buildManualMemberSetupMattermostMessage({
          displayName,
          setupUrl,
        });
        await withActiveMattermostSenderForGeneration(
          mattermostRecipient.senderGeneration,
          (session) => session.sendDirectMessage(
            mattermostRecipient.mattermostUserId,
            message,
          ),
        );
      } catch {
        throw new ManualMemberImportDeliveryOutcomeUnknownError();
      }
    } else {
      if (!emailRecipient) {
        throw new Error("회원의 현재 이메일 주소를 확인하지 못했습니다.");
      }
      try {
        await sendSetupEmail({
          email: emailRecipient.email,
          displayName,
          token: setupToken,
          reset: false,
          idempotencyKey: deliveryIdempotencyKey,
        });
      } catch {
        throw new ManualMemberImportDeliveryOutcomeUnknownError();
      }
    }

    const sent = await checkpointManualMemberImportDeliverySent({
      row: processingRow,
      rowLeaseVersion: currentRowLeaseVersion,
      deliveryChannel: row.delivery_channel,
      deliveryIdempotencyKey,
    });
    currentRowLeaseVersion = sent.rowLeaseVersion;
    const { data: completedRow, error: completedRowError } = await supabase
      .from("manual_member_import_rows")
      .update({
        status: "created",
        error_code: null,
        error_message: null,
      })
      .eq("id", row.id)
      .eq("batch_id", row.batch_id)
      .eq("status", "processing")
      .eq("updated_at", currentRowLeaseVersion)
      .select("id")
      .maybeSingle();
    if (completedRowError || !completedRow) {
      throw new ManualMemberImportDeliveryOutcomeUnknownError();
    }

    await removeStagingFile(row).catch(() => undefined);
    await supabase
      .from("manual_member_import_rows")
      .update({ staging_deleted_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("batch_id", row.batch_id)
      .eq("status", "created")
      .is("staging_deleted_at", null);

    return {
      rowNumber: row.row_number,
      status: "success",
      name: displayName,
      mmId: row.mm_username,
      email: row.email_normalized,
      deliveryChannel: row.delivery_channel,
      reason: null,
      retryable: false,
      existingMemberId: null,
    };
  } catch (error) {
    const reason = error instanceof ManualMemberImportDeliveryOutcomeUnknownError
      ? error.message
      : "새 초기 설정 링크를 발급하지 못했습니다. 수신 여부를 확인한 뒤 다시 시도해 주세요.";
    await supabase
      .from("manual_member_import_rows")
      .update({
        status: "failed",
        error_code: "delivery_outcome_unknown",
        error_message: reason,
      })
      .eq("id", row.id)
      .eq("batch_id", row.batch_id)
      .eq("status", "processing")
      .eq("updated_at", currentRowLeaseVersion);
    throw new Error(reason);
  }
}

export async function completeManualMemberPasswordAction(input: {
  token: string;
  passwordHash: string;
  passwordSalt: string;
}) {
  const { data, error } = await getSupabaseAdminClient().rpc(
    "complete_member_password_action_with_delivery",
    {
      p_token_hash: hashOpaqueToken(input.token),
      p_password_hash: input.passwordHash,
      p_password_salt: input.passwordSalt,
    },
  );
  if (
    error
    || !data
    || typeof data !== "object"
    || typeof (data as Record<string, unknown>).memberId !== "string"
    || ((data as Record<string, unknown>).deliveryChannel !== "email"
      && (data as Record<string, unknown>).deliveryChannel !== "mattermost")
  ) {
    return null;
  }
  return {
    memberId: (data as Record<string, unknown>).memberId as string,
    deliveryChannel: (data as Record<string, unknown>).deliveryChannel as "email" | "mattermost",
  };
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
