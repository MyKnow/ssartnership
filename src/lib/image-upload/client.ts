"use client";

import {
  inferImageSourceContentType,
  type ImageUploadPurpose,
} from "@/lib/image-upload/policy";
import {
  ClientSafeRequestError,
  getClientSafeRequestError,
} from "@/lib/client-safe-request-error";

export type ClientImageUploadRequest = {
  clientId: string;
  role: string;
  file: File;
};

type ImageUploadApiResponse<T> =
  | { ok: true; [key: string]: unknown } & T
  | { ok: false; message?: string };

type SignResponse = ImageUploadApiResponse<{
  uploads: Array<{
    id: string;
    clientId: string;
    signedUrl: string;
  }>;
  uploadHeaders: Record<string, string>;
}>;

type CompleteResponse = ImageUploadApiResponse<{
  uploads: Array<{ id: string }>;
}> & { code?: string };

export type ClientImageUploadResult = {
  clientId: string;
  uploadId: string;
};

function getMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && typeof (payload as { message?: unknown }).message === "string"
    ? (payload as { message: string }).message
    : fallback;
}

function waitForUploadCompletionRetry(delayMs: number) {
  return new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, delayMs);
  });
}

async function completeStagedUploads(input: {
  purpose: ImageUploadPurpose;
  actorMode?: "admin" | "member" | "partner" | "guest" | "signup";
  uploadIds: string[];
}) {
  let lastError = new ClientSafeRequestError(
    "request_failed",
    "이미지를 처리하지 못했습니다.",
  );
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let retryable = false;
    try {
      const response = await fetch("/api/uploads/images/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          purpose: input.purpose,
          ...(input.actorMode ? { actorMode: input.actorMode } : {}),
          uploadIds: input.uploadIds,
        }),
      });
      const payload = await response.json().catch(() => null) as CompleteResponse | null;
      if (response.ok && payload?.ok) {
        return payload;
      }
      lastError = new ClientSafeRequestError(
        "request_failed",
        getMessage(payload, lastError.message),
      );
      retryable = response.status >= 500
        || (response.status === 409 && payload?.code === "upload_processing");
    } catch (error) {
      lastError = getClientSafeRequestError(error, {
        requestFailed: "이미지를 처리하지 못했습니다.",
        networkUnavailable:
          "이미지 처리 요청에 실패했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
      });
      retryable = true;
    }
    if (!retryable || attempt === 2) {
      throw lastError;
    }
    await waitForUploadCompletionRetry(250 * (attempt + 1));
  }
  throw lastError;
}

export async function uploadImagesToStaging(input: {
  purpose: ImageUploadPurpose;
  actorMode?: "admin" | "member" | "partner" | "guest" | "signup";
  uploads: ClientImageUploadRequest[];
}): Promise<ClientImageUploadResult[]> {
  if (input.uploads.length === 0) return [];
  let signResponse: Response;
  try {
    signResponse = await fetch("/api/uploads/images/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        purpose: input.purpose,
        ...(input.actorMode ? { actorMode: input.actorMode } : {}),
        uploads: input.uploads.map((upload) => ({
          clientId: upload.clientId,
          role: upload.role,
          fileName: upload.file.name,
          contentType: inferImageSourceContentType(upload.file) ?? "application/octet-stream",
          size: upload.file.size,
        })),
      }),
    });
  } catch (error) {
    throw getClientSafeRequestError(error, {
      requestFailed: "이미지 업로드 URL을 발급하지 못했습니다.",
      networkUnavailable:
        "이미지 업로드 URL을 발급하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
    });
  }
  const signPayload = await signResponse.json().catch(() => null) as SignResponse | null;
  if (!signResponse.ok || !signPayload || !signPayload.ok) {
    throw new ClientSafeRequestError(
      "request_failed",
      getMessage(signPayload, "이미지 업로드 URL을 발급하지 못했습니다."),
    );
  }
  const signedByClientId = new Map(signPayload.uploads.map((upload) => [upload.clientId, upload]));
  await Promise.all(
    input.uploads.map(async (upload) => {
      const signed = signedByClientId.get(upload.clientId);
      if (!signed) {
        throw new ClientSafeRequestError(
          "invalid_response",
          "이미지 업로드 정보를 확인해 주세요.",
        );
      }
      let response: Response;
      try {
        response = await fetch(signed.signedUrl, {
          method: "PUT",
          headers: {
            ...signPayload.uploadHeaders,
            "content-type": inferImageSourceContentType(upload.file) ?? "image/webp",
          },
          body: upload.file,
        });
      } catch (error) {
        throw getClientSafeRequestError(error, {
          requestFailed: "이미지 파일을 업로드하지 못했습니다. 다시 시도해 주세요.",
          networkUnavailable:
            "이미지 파일을 업로드하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
        });
      }
      if (!response.ok) {
        throw new ClientSafeRequestError(
          "request_failed",
          "이미지 파일을 업로드하지 못했습니다. 다시 시도해 주세요.",
        );
      }
    }),
  );
  const completePayload = await completeStagedUploads({
    purpose: input.purpose,
    actorMode: input.actorMode,
    uploadIds: signPayload.uploads.map((upload) => upload.id),
  });
  const completedIds = new Set(completePayload.uploads.map((upload) => upload.id));
  return signPayload.uploads.map((upload) => {
    if (!completedIds.has(upload.id)) {
      throw new ClientSafeRequestError(
        "invalid_response",
        "이미지 처리 상태를 확인해 주세요.",
      );
    }
    return { clientId: upload.clientId, uploadId: upload.id };
  });
}
