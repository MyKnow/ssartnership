import { randomUUID } from "node:crypto";
import {
  IMAGE_UPLOAD_SESSION_TTL_MS,
  IMAGE_UPLOAD_APPROVAL_SESSION_TTL_MS,
  IMAGE_UPLOAD_STAGING_BUCKET,
  getImageUploadSignedUrlExpiresAt,
  isImageUploadSignedUrlExpired,
  type AttachImageUploadInput,
  type AttachedImageUpload,
  type CompleteImageUploadInput,
  type CompletedImageUpload,
  type ImageUploadRepository,
  type RetainImageUploadForApprovalInput,
  type DiscardImageUploadInput,
  type SignImageUploadInput,
  type SignedImageUpload,
  ImageUploadError,
} from "@/lib/image-upload/repository";
import {
  resolveImageTransformPolicy,
  validateImageUploadSource,
  type ImageUploadPurpose,
} from "@/lib/image-upload/policy";
import {
  normalizeImageUpload,
  validateNormalizedImageUpload,
} from "@/lib/image-upload/transform.server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

type ImageUploadSessionRow = {
  id: string;
  owner_kind: string;
  owner_id: string;
  purpose: ImageUploadPurpose;
  role: string;
  storage_bucket: string;
  storage_path: string;
  source_storage_path: string | null;
  source_content_type: string | null;
  source_size_bytes: number | null;
  content_type: string | null;
  sha256: string | null;
  width: number | null;
  height: number | null;
  final_bucket: string | null;
  final_path: string | null;
  final_url: string | null;
  status: "signed" | "processing" | "ready" | "attaching" | "attached" | "expired" | "failed";
  signed_url_expires_at: string;
  expires_at: string;
  attached_resource_type: string | null;
  attached_resource_id: string | null;
  failure_code: string | null;
};

const MAX_SIGNED_UPLOADS_PER_REQUEST = 20;
const STORAGE_RETRY_DELAYS_MS = [0, 120, 300] as const;

function asSessionRow(value: unknown): ImageUploadSessionRow {
  return value as ImageUploadSessionRow;
}

function getSafeFileExtension(name: string) {
  const suffix = name.trim().toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  return suffix ? `.${suffix}` : ".source";
}

function buildStagingPath(id: string, fileName: string) {
  return `staging/${id}${getSafeFileExtension(fileName)}`;
}

function buildProcessedPath(id: string) {
  return `processed/${id}.webp`;
}

function getSessionStoragePaths(session: Pick<ImageUploadSessionRow, "storage_path" | "source_storage_path">) {
  return Array.from(new Set(
    [session.storage_path, session.source_storage_path].filter(
      (path): path is string => Boolean(path),
    ),
  ));
}

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdminClient>;

function getPublicUrl(supabase: SupabaseAdminClient, bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function assertOwnedSession(
  session: ImageUploadSessionRow,
  input: { actor: { kind: string; id: string }; purpose: ImageUploadPurpose },
) {
  if (
    session.owner_kind !== input.actor.kind
    || session.owner_id !== input.actor.id
    || session.purpose !== input.purpose
  ) {
    throw new Error("이미지 업로드 권한을 확인해 주세요.");
  }
}

function assertSignupPurposeBoundary(input: {
  actor: { kind: string; id: string };
  purpose: ImageUploadPurpose;
}) {
  if (input.purpose === "member-signup-profile" && input.actor.kind !== "signup") {
    throw new Error("신규 가입 프로필 업로드 권한을 확인해 주세요.");
  }
  if (input.actor.kind === "signup" && input.purpose !== "member-signup-profile") {
    throw new Error("signup 업로드 권한은 신규 가입 프로필에서만 사용할 수 있습니다.");
  }
  if (input.actor.kind === "signup" && !isUuid(input.actor.id)) {
    throw new Error("signup 업로드 소유자를 확인해 주세요.");
  }
}

function hasSameDestination(
  session: ImageUploadSessionRow,
  destination: AttachImageUploadInput["destination"],
) {
  return session.final_bucket === destination.bucket
    && session.final_path === destination.path;
}

function hasSameResource(
  session: ImageUploadSessionRow,
  resource: AttachImageUploadInput["resource"],
) {
  return session.attached_resource_type === (resource?.type ?? null)
    && session.attached_resource_id === (resource?.id ?? null);
}

function toAttachedImage(session: ImageUploadSessionRow): AttachedImageUpload {
  if (
    !session.width
    || !session.height
    || !session.final_bucket
    || !session.final_path
    || !session.sha256
  ) {
    throw new Error("이미지 업로드 상태를 확인해 주세요.");
  }
  return {
    id: session.id,
    bucket: session.final_bucket,
    path: session.final_path,
    url: session.final_url,
    sha256: session.sha256,
    width: session.width,
    height: session.height,
  };
}

async function markFailed(
  supabase: SupabaseAdminClient,
  id: string,
  code: string,
  statuses: Array<ImageUploadSessionRow["status"]>,
) {
  await supabase
    .from("image_upload_sessions")
    .update({ status: "failed", failure_code: code })
    .eq("id", id)
    .in("status", statuses);
}

export class SupabaseImageUploadRepository implements ImageUploadRepository {
  private readonly supabase: SupabaseAdminClient;

  constructor(supabase: SupabaseAdminClient = getSupabaseAdminClient()) {
    this.supabase = supabase;
  }

  async sign(input: SignImageUploadInput): Promise<SignedImageUpload[]> {
    assertSignupPurposeBoundary(input);
    if (input.uploads.length === 0 || input.uploads.length > MAX_SIGNED_UPLOADS_PER_REQUEST) {
      throw new Error("한 번에 업로드할 수 있는 이미지 수를 확인해 주세요.");
    }
    const now = input.now ?? new Date();
    const expiresAt = new Date(now.getTime() + IMAGE_UPLOAD_SESSION_TTL_MS);
    const signedUrlExpiresAt = getImageUploadSignedUrlExpiresAt(now);
    const sessions = input.uploads.map((upload) => {
      const policy = resolveImageTransformPolicy(input.purpose, upload.role);
      const validationError = validateImageUploadSource({
        name: upload.fileName,
        type: upload.contentType,
        size: upload.size,
      }, policy);
      if (validationError) throw new Error(validationError);
      const id = randomUUID();
      return {
        id,
        clientId: upload.clientId,
        role: upload.role,
        path: buildStagingPath(id, upload.fileName),
        sourceContentType: upload.contentType || null,
        sourceSizeBytes: upload.size,
      };
    });
    const supabase = this.supabase;
    const { error: insertError } = await supabase.from("image_upload_sessions").insert(
      sessions.map((session) => ({
        id: session.id,
        owner_kind: input.actor.kind,
        owner_id: input.actor.id,
        purpose: input.purpose,
        role: session.role,
        storage_bucket: IMAGE_UPLOAD_STAGING_BUCKET,
        storage_path: session.path,
        source_storage_path: session.path,
        source_content_type: session.sourceContentType,
        source_size_bytes: session.sourceSizeBytes,
        signed_url_expires_at: signedUrlExpiresAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })),
    );
    if (insertError) {
      throw new Error("이미지 업로드 세션을 만들지 못했습니다.");
    }

    try {
      return await Promise.all(
        sessions.map(async (session) => {
          const { data, error } = await supabase.storage
            .from(IMAGE_UPLOAD_STAGING_BUCKET)
            .createSignedUploadUrl(session.path, { upsert: true });
          if (error || !data?.signedUrl) {
            throw new Error("이미지 업로드 URL을 발급하지 못했습니다.");
          }
          return {
            id: session.id,
            clientId: session.clientId,
            path: session.path,
            signedUrl: data.signedUrl,
            expiresAt: signedUrlExpiresAt.toISOString(),
          };
        }),
      );
    } catch (error) {
      await Promise.all(sessions.map((session) => markFailed(supabase, session.id, "sign_failed", ["signed"])));
      throw error;
    }
  }

  async complete(input: CompleteImageUploadInput): Promise<CompletedImageUpload[]> {
    assertSignupPurposeBoundary(input);
    const uploadIds = Array.from(new Set(input.uploadIds));
    if (uploadIds.length === 0 || uploadIds.length > MAX_SIGNED_UPLOADS_PER_REQUEST) {
      throw new Error("이미지 업로드 정보를 확인해 주세요.");
    }
    const now = input.now ?? new Date();
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from("image_upload_sessions")
      .select("*")
      .in("id", uploadIds);
    if (error || (data?.length ?? 0) !== uploadIds.length) {
      throw new Error("이미지 업로드 세션을 찾을 수 없습니다.");
    }
    const sessionsById = new Map(
      (data ?? []).map((row) => {
        const session = asSessionRow(row);
        assertOwnedSession(session, input);
        return [session.id, session];
      }),
    );

    const completed = await Promise.all(
      uploadIds.map(async (id) => {
        const session = sessionsById.get(id);
        if (!session) throw new Error("이미지 업로드 세션을 찾을 수 없습니다.");
        if (new Date(session.expires_at).getTime() <= now.getTime()) {
          await supabase
            .from("image_upload_sessions")
            .update({ status: "expired" })
            .eq("id", session.id)
            .in("status", ["signed", "processing", "ready"]);
          throw new Error("이미지 업로드 시간이 만료되었습니다. 다시 시도해 주세요.");
        }
        if (session.status === "attached" && input.purpose === "member-signup-profile") {
          throw new Error("가입 프로필 업로드가 이미 처리되었습니다.");
        }
        if (session.status === "attached" || session.status === "ready") {
          if (!session.width || !session.height) {
            throw new Error("이미지 업로드 상태를 확인해 주세요.");
          }
          return {
            id: session.id,
            role: session.role,
            status: session.status,
            width: session.width,
            height: session.height,
          } satisfies CompletedImageUpload;
        }
        if (session.status === "processing") {
          throw new Error("이미지를 처리 중입니다. 잠시 후 다시 시도해 주세요.");
        }
        if (session.status !== "signed") {
          throw new Error("이미지 업로드 상태를 확인해 주세요.");
        }
        if (isImageUploadSignedUrlExpired(session.signed_url_expires_at, now)) {
          await supabase.storage.from(session.storage_bucket).remove([session.storage_path]).catch(() => undefined);
          await supabase
            .from("image_upload_sessions")
            .update({ status: "expired" })
            .eq("id", session.id)
            .eq("status", "signed");
          throw new Error("이미지 업로드 URL이 만료되었습니다. 다시 시도해 주세요.");
        }

        const { data: claimedData, error: claimError } = await supabase
          .from("image_upload_sessions")
          .update({ status: "processing", failure_code: null })
          .eq("id", session.id)
          .eq("status", "signed")
          .select("*")
          .maybeSingle();
        if (claimError) {
          throw new Error("이미지 업로드 처리 상태를 저장하지 못했습니다.");
        }
        if (!claimedData) {
          const { data: latestData, error: latestError } = await supabase
            .from("image_upload_sessions")
            .select("*")
            .eq("id", session.id)
            .maybeSingle();
          const latest = latestData ? asSessionRow(latestData) : null;
          if (latestError || !latest) {
            throw new Error("이미지 업로드 상태를 확인해 주세요.");
          }
          assertOwnedSession(latest, input);
          if (latest.status === "attached" && input.purpose === "member-signup-profile") {
            throw new Error("가입 프로필 업로드가 이미 처리되었습니다.");
          }
          if (latest.status === "attached" || latest.status === "ready") {
            if (!latest.width || !latest.height) {
              throw new Error("이미지 업로드 상태를 확인해 주세요.");
            }
            return {
              id: latest.id,
              role: latest.role,
              status: latest.status,
              width: latest.width,
              height: latest.height,
            } satisfies CompletedImageUpload;
          }
          if (latest.status === "processing") {
            throw new Error("이미지를 처리 중입니다. 잠시 후 다시 시도해 주세요.");
          }
          throw new Error("이미지 업로드 상태를 확인해 주세요.");
        }
        const claimedSession = asSessionRow(claimedData);

        try {
          const sourceStoragePath = claimedSession.source_storage_path ?? claimedSession.storage_path;
          const { data: blob, error: downloadError } = await supabase.storage
            .from(claimedSession.storage_bucket)
            .download(sourceStoragePath);
          if (downloadError || !blob) {
            throw new Error("이미지 파일을 찾을 수 없습니다.");
          }
          const normalized = await normalizeImageUpload({
            source: Buffer.from(await blob.arrayBuffer()),
            declaredContentType: claimedSession.source_content_type,
            policy: resolveImageTransformPolicy(input.purpose, claimedSession.role),
          });
          const processedStoragePath = buildProcessedPath(claimedSession.id);
          const { error: uploadError } = await supabase.storage
            .from(claimedSession.storage_bucket)
            .upload(processedStoragePath, normalized.buffer, {
              contentType: normalized.contentType,
              cacheControl: "private, no-store",
              upsert: true,
            });
          if (uploadError) {
            throw new Error("이미지를 안전하게 처리하지 못했습니다.");
          }
          const { data: readyData, error: updateError } = await supabase
            .from("image_upload_sessions")
            .update({
              status: "ready",
              storage_path: processedStoragePath,
              content_type: normalized.contentType,
              sha256: normalized.sha256,
              width: normalized.width,
              height: normalized.height,
              completed_at: now.toISOString(),
              failure_code: null,
            })
            .eq("id", claimedSession.id)
            .eq("status", "processing")
            .select("id")
            .maybeSingle();
          if (updateError || !readyData) {
            throw new Error("이미지 업로드 상태를 저장하지 못했습니다.");
          }
          if (sourceStoragePath !== processedStoragePath) {
            await supabase.storage
              .from(claimedSession.storage_bucket)
              .remove([sourceStoragePath])
              .catch(() => undefined);
          }
          return {
            id: claimedSession.id,
            role: claimedSession.role,
            status: "ready",
            width: normalized.width,
            height: normalized.height,
          } satisfies CompletedImageUpload;
        } catch (error) {
          await markFailed(supabase, claimedSession.id, "complete_failed", ["processing"]);
          throw error instanceof Error
            ? error
            : new Error("이미지를 처리하지 못했습니다.");
        }
      }),
    );
    return completed;
  }

  async attach(input: AttachImageUploadInput): Promise<AttachedImageUpload> {
    assertSignupPurposeBoundary(input);
    const now = input.now ?? new Date();
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from("image_upload_sessions")
      .select("*")
      .eq("id", input.uploadId)
      .maybeSingle();
    if (error || !data) {
      throw new Error("이미지 업로드 세션을 찾을 수 없습니다.");
    }
    const session = asSessionRow(data);
    assertOwnedSession(session, input);
    if (session.role !== input.role) {
      throw new Error("이미지 업로드 역할을 확인해 주세요.");
    }
    if (new Date(session.expires_at).getTime() <= now.getTime() && session.status !== "attached") {
      await supabase
        .from("image_upload_sessions")
        .update({ status: "expired" })
        .eq("id", session.id)
        .in("status", ["signed", "processing", "ready", "attaching"]);
      throw new Error("이미지 업로드 시간이 만료되었습니다. 다시 시도해 주세요.");
    }
    if (session.status === "attached") {
      if (!hasSameDestination(session, input.destination) || !hasSameResource(session, input.resource)) {
        throw new Error("이미지가 다른 요청에 이미 연결되어 있습니다.");
      }
      return toAttachedImage(session);
    }
    if (session.status !== "ready" && session.status !== "attaching") {
      throw new Error("완료되지 않은 이미지 업로드입니다.");
    }

    const expectedPolicy = resolveImageTransformPolicy(input.purpose, input.role);
    if (
      input.policy.key !== expectedPolicy.key
      || session.content_type !== "image/webp"
      || !session.sha256
      || session.width !== expectedPolicy.width
      || session.height !== expectedPolicy.height
    ) {
      throw new Error("이미지 업로드 상태를 확인해 주세요.");
    }

    let claimedSession = session;
    if (session.status === "ready") {
      const { data: claimedData, error: claimError } = await supabase
        .from("image_upload_sessions")
        .update({
          status: "attaching",
          final_bucket: input.destination.bucket,
          final_path: input.destination.path,
          final_url: null,
          attached_resource_type: input.resource?.type ?? null,
          attached_resource_id: input.resource?.id ?? null,
        })
        .eq("id", session.id)
        .eq("status", "ready")
        .select("*")
        .maybeSingle();
      if (claimError) {
        throw new Error("이미지 연결 상태를 저장하지 못했습니다.");
      }
      if (claimedData) {
        claimedSession = asSessionRow(claimedData);
      } else {
        const { data: latestData, error: latestError } = await supabase
          .from("image_upload_sessions")
          .select("*")
          .eq("id", session.id)
          .maybeSingle();
        const latest = latestData ? asSessionRow(latestData) : null;
        if (latestError || !latest) {
          throw new Error("이미지 업로드 상태를 확인해 주세요.");
        }
        assertOwnedSession(latest, input);
        if (latest.role !== input.role) {
          throw new Error("이미지 업로드 역할을 확인해 주세요.");
        }
        if (latest.status === "attached") {
          if (!hasSameDestination(latest, input.destination) || !hasSameResource(latest, input.resource)) {
            throw new Error("이미지가 다른 요청에 이미 연결되어 있습니다.");
          }
          return toAttachedImage(latest);
        }
        if (
          latest.status !== "attaching"
          || !hasSameDestination(latest, input.destination)
          || !hasSameResource(latest, input.resource)
        ) {
          throw new Error("이미지가 다른 요청에서 처리 중입니다. 잠시 후 다시 시도해 주세요.");
        }
        claimedSession = latest;
      }
    } else if (
      !hasSameDestination(session, input.destination)
      || !hasSameResource(session, input.resource)
    ) {
      throw new Error("이미지가 다른 요청에 이미 연결되어 있습니다.");
    }
    if (!claimedSession.sha256) {
      throw new Error("이미지 업로드 상태를 확인해 주세요.");
    }

    try {
      let stagedBuffer: Buffer | null = null;
      let lastStagingError: unknown = null;
      for (const [attempt, delay] of STORAGE_RETRY_DELAYS_MS.entries()) {
        if (delay > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        }
        try {
          const { data: blob, error: downloadError } = await supabase.storage
            .from(claimedSession.storage_bucket)
            .download(claimedSession.storage_path);
          if (downloadError || !blob) {
            throw new Error("처리된 이미지 파일을 찾을 수 없습니다.");
          }
          const candidateBuffer = Buffer.from(await blob.arrayBuffer());
          try {
            await validateNormalizedImageUpload({
              source: candidateBuffer,
              policy: expectedPolicy,
              expectedSha256: claimedSession.sha256,
            });
          } catch (error) {
            throw new ImageUploadError(
              "profile_image_staging_integrity",
              "처리된 이미지 무결성을 확인해 주세요.",
              { cause: error },
            );
          }
          stagedBuffer = candidateBuffer;
          break;
        } catch (error) {
          lastStagingError = error;
          if (attempt === STORAGE_RETRY_DELAYS_MS.length - 1) {
            throw error;
          }
        }
      }
      if (!stagedBuffer) {
        throw lastStagingError instanceof Error
          ? lastStagingError
          : new Error("처리된 이미지 파일을 확인하지 못했습니다.");
      }

      let finalUploadError: unknown = null;
      for (const [attempt, delay] of STORAGE_RETRY_DELAYS_MS.entries()) {
        if (delay > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, delay));
        }
        const { error: uploadError } = await supabase.storage
          .from(input.destination.bucket)
          .upload(input.destination.path, stagedBuffer, {
            contentType: "image/webp",
            cacheControl: input.destination.cacheControl ?? "31536000",
            upsert: true,
          });
        if (!uploadError) {
          finalUploadError = null;
          break;
        }
        finalUploadError = uploadError;
        if (attempt === STORAGE_RETRY_DELAYS_MS.length - 1) {
          break;
        }
      }
      if (finalUploadError) {
        throw new ImageUploadError(
          "profile_image_final_upload",
          "이미지를 최종 보관소로 옮기지 못했습니다.",
          { cause: finalUploadError instanceof Error ? finalUploadError : undefined },
        );
      }
      const url = input.destination.isPublic
        ? getPublicUrl(supabase, input.destination.bucket, input.destination.path)
        : null;
      const { data: attachedData, error: updateError } = await supabase
        .from("image_upload_sessions")
        .update({
          status: "attached",
          content_type: "image/webp",
          final_url: url,
          attached_at: now.toISOString(),
        })
        .eq("id", claimedSession.id)
        .eq("status", "attaching")
        .select("*")
        .maybeSingle();
      if (updateError) {
        throw new ImageUploadError(
          "profile_image_attach_state",
          "이미지 연결 상태를 저장하지 못했습니다.",
          { cause: updateError },
        );
      }
      let attachedSession = attachedData ? asSessionRow(attachedData) : null;
      if (!attachedSession) {
        const { data: latestData, error: latestError } = await supabase
          .from("image_upload_sessions")
          .select("*")
          .eq("id", claimedSession.id)
          .maybeSingle();
        if (latestError || !latestData) {
          throw new Error("이미지 연결 상태를 확인하지 못했습니다.");
        }
        attachedSession = asSessionRow(latestData);
      }
      if (
        attachedSession.status !== "attached"
        || !hasSameDestination(attachedSession, input.destination)
        || !hasSameResource(attachedSession, input.resource)
      ) {
        throw new Error("이미지 연결 상태를 확인하지 못했습니다.");
      }
      await supabase.storage
        .from(claimedSession.storage_bucket)
        .remove(getSessionStoragePaths(claimedSession))
        .catch(() => undefined);
      return toAttachedImage(attachedSession);
    } catch (error) {
      await markFailed(supabase, claimedSession.id, "attach_failed", ["attaching"]).catch(() => undefined);
      throw error instanceof Error
        ? error
        : new Error("이미지를 최종 보관소에 연결하지 못했습니다.");
    }
  }

  async retainForApproval(input: RetainImageUploadForApprovalInput): Promise<void> {
    assertSignupPurposeBoundary(input);
    if (
      input.actor.kind !== "signup"
      || input.purpose !== "member-signup-profile"
      || input.role !== "profile"
    ) {
      throw new Error("승인용 프로필 업로드 권한을 확인해 주세요.");
    }
    const now = input.now ?? new Date();
    const latestAllowedExpiry = new Date(now.getTime() + IMAGE_UPLOAD_APPROVAL_SESSION_TTL_MS);
    if (
      input.expiresAt.getTime() <= now.getTime()
      || input.expiresAt.getTime() > latestAllowedExpiry.getTime()
    ) {
      throw new Error("승인용 이미지 보관 기간을 확인해 주세요.");
    }
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from("image_upload_sessions")
      .select("*")
      .eq("id", input.uploadId)
      .maybeSingle();
    if (error || !data) {
      throw new Error("이미지 업로드 세션을 찾을 수 없습니다.");
    }
    const session = asSessionRow(data);
    assertOwnedSession(session, input);
    if (session.role !== input.role || session.status !== "ready") {
      throw new Error("승인에 사용할 이미지 업로드가 준비되지 않았습니다.");
    }
    if (new Date(session.expires_at).getTime() <= now.getTime()) {
      throw new Error("이미지 업로드 시간이 만료되었습니다.");
    }
    const { data: retained, error: retainError } = await supabase
      .from("image_upload_sessions")
      .update({ expires_at: input.expiresAt.toISOString(), failure_code: null })
      .eq("id", session.id)
      .eq("owner_kind", input.actor.kind)
      .eq("owner_id", input.actor.id)
      .eq("purpose", input.purpose)
      .eq("role", input.role)
      .eq("status", "ready")
      .select("id")
      .maybeSingle();
    if (retainError || !retained?.id) {
      throw new Error("승인용 이미지 보관 기간을 저장하지 못했습니다.");
    }
  }

  async discard(input: DiscardImageUploadInput): Promise<void> {
    assertSignupPurposeBoundary(input);
    const now = input.now ?? new Date();
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from("image_upload_sessions")
      .select("*")
      .eq("id", input.uploadId)
      .maybeSingle();
    if (error || !data) {
      throw new Error("이미지 업로드 세션을 찾을 수 없습니다.");
    }
    const session = asSessionRow(data);
    assertOwnedSession(session, input);
    if (session.status === "expired") return;

    const removals = await Promise.all([
      supabase.storage
        .from(session.storage_bucket)
        .remove(getSessionStoragePaths(session)),
      ...(session.final_bucket && session.final_path
        ? [supabase.storage.from(session.final_bucket).remove([session.final_path])]
        : []),
    ]);
    const removalError = removals.find((result) => result.error)?.error;
    if (removalError) {
      await supabase
        .from("image_upload_sessions")
        .update({
          status: "failed",
          failure_code: "discard_cleanup_pending",
          signed_url_expires_at: now.toISOString(),
          expires_at: now.toISOString(),
        })
        .eq("id", session.id)
        .in("status", ["signed", "processing", "ready", "attaching", "attached"]);
      throw new Error("이미지 임시 파일을 바로 삭제하지 못했습니다.");
    }
    const { error: updateError } = await supabase
      .from("image_upload_sessions")
      .update({
        status: "expired",
        failure_code: null,
        signed_url_expires_at: now.toISOString(),
        expires_at: now.toISOString(),
      })
      .eq("id", session.id)
      .in("status", ["signed", "processing", "ready", "attaching", "attached", "failed"]);
    if (updateError) {
      throw new Error("이미지 업로드 만료 상태를 저장하지 못했습니다.");
    }
  }

  async expireStale(now = new Date()): Promise<number> {
    const supabase = this.supabase;
    const [signedResult, sessionResult] = await Promise.all([
      supabase
        .from("image_upload_sessions")
        .select("id,status,storage_bucket,storage_path,source_storage_path,final_bucket,final_path,failure_code")
        .eq("status", "signed")
        .lte("signed_url_expires_at", now.toISOString())
        .limit(100),
      supabase
        .from("image_upload_sessions")
        .select("id,status,storage_bucket,storage_path,source_storage_path,final_bucket,final_path,failure_code")
        .in("status", ["signed", "processing", "ready", "attaching", "failed"])
        .lte("expires_at", now.toISOString())
        .limit(100),
    ]);
    if (signedResult.error || sessionResult.error) {
      throw new Error("만료된 이미지 업로드를 조회하지 못했습니다.");
    }
    const sessions = Array.from(
      new Map(
        [...(signedResult.data ?? []), ...(sessionResult.data ?? [])].map((session) => [
          session.id,
          session,
        ]),
      ).values(),
    ) as Array<Pick<
      ImageUploadSessionRow,
      "id" | "status" | "storage_bucket" | "storage_path" | "source_storage_path"
      | "final_bucket" | "final_path" | "failure_code"
    >>;
    if (sessions.length === 0) return 0;
    let expiredCount = 0;
    for (const session of sessions) {
      const removals = await Promise.all([
        supabase.storage.from(session.storage_bucket).remove(getSessionStoragePaths(session)),
        ...(session.final_bucket && session.final_path
          ? [supabase.storage.from(session.final_bucket).remove([session.final_path])]
          : []),
      ]);
      const removalError = removals.find((result) => result.error)?.error;
      if (removalError) {
        await supabase
          .from("image_upload_sessions")
          .update({
            status: "failed",
            failure_code: "discard_cleanup_pending",
            signed_url_expires_at: now.toISOString(),
            expires_at: now.toISOString(),
          })
          .eq("id", session.id)
          .in("status", ["signed", "processing", "ready", "attaching", "failed"]);
        continue;
      }
      const { error: updateError } = await supabase
        .from("image_upload_sessions")
        .update({
          status: "expired",
          failure_code: null,
          signed_url_expires_at: now.toISOString(),
          expires_at: now.toISOString(),
        })
        .eq("id", session.id)
        .in("status", ["signed", "processing", "ready", "attaching", "failed"]);
      if (updateError) {
        throw new Error("만료된 이미지 업로드 상태를 저장하지 못했습니다.");
      }
      expiredCount += 1;
    }
    return expiredCount;
  }
}

let repository: ImageUploadRepository | null = null;

export function getImageUploadRepository() {
  repository ??= new SupabaseImageUploadRepository();
  return repository;
}

export function getSignedImageUploadHeaders() {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error("SUPABASE_ANON_KEY 환경 변수가 필요합니다.");
  }
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
}
