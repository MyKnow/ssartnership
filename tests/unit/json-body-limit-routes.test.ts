import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  deletePartnerStoredNotificationsMock,
  getPartnerSessionMock,
  imageUploadCompleteMock,
  imageUploadSignMock,
  isImageUploadBlockedMock,
  isPartnerPortalCompanyAllowedMock,
  isTrustedSameOriginRequestMock,
  markPartnerStoredNotificationsReadMock,
  recordImageUploadAttemptMock,
  resolveImageUploadActorForRouteMock,
} = vi.hoisted(() => ({
  deletePartnerStoredNotificationsMock: vi.fn(),
  getPartnerSessionMock: vi.fn(),
  imageUploadCompleteMock: vi.fn(),
  imageUploadSignMock: vi.fn(),
  isImageUploadBlockedMock: vi.fn(),
  isPartnerPortalCompanyAllowedMock: vi.fn(),
  isTrustedSameOriginRequestMock: vi.fn(),
  markPartnerStoredNotificationsReadMock: vi.fn(),
  recordImageUploadAttemptMock: vi.fn(),
  resolveImageUploadActorForRouteMock: vi.fn(),
}));

vi.mock("@/lib/partner-portal-scope", () => ({
  isPartnerPortalCompanyAllowed: isPartnerPortalCompanyAllowedMock,
}));

vi.mock("@/lib/partner-notification-store", () => ({
  deletePartnerStoredNotifications: deletePartnerStoredNotificationsMock,
  listPartnerStoredNotifications: vi.fn(),
  markPartnerStoredNotificationsRead: markPartnerStoredNotificationsReadMock,
}));

vi.mock("@/lib/partner-session", () => ({
  getPartnerSession: getPartnerSessionMock,
}));

vi.mock("@/lib/request-guards", () => ({
  isTrustedSameOriginRequest: isTrustedSameOriginRequestMock,
}));

vi.mock("@/lib/activity-logs", () => ({
  getRequestLogContext: vi.fn(() => ({ ipAddress: "127.0.0.1" })),
}));

vi.mock("@/lib/image-upload/auth.server", () => {
  class ImageUploadAuthorizationError extends Error {
    readonly status = 401;
  }

  return {
    IMAGE_UPLOAD_GUEST_COOKIE: "image_upload_guest",
    IMAGE_UPLOAD_GUEST_COOKIE_MAX_AGE_SECONDS: 3600,
    ImageUploadAuthorizationError,
    imageUploadActorIdentifier: vi.fn(() => "actor-1"),
    resolveImageUploadActorForRoute: resolveImageUploadActorForRouteMock,
  };
});

vi.mock("@/lib/image-upload/repository.server", () => ({
  getImageUploadRepository: vi.fn(() => ({
    complete: imageUploadCompleteMock,
    sign: imageUploadSignMock,
  })),
  getSignedImageUploadHeaders: vi.fn(() => ({})),
}));

vi.mock("@/lib/image-upload/rate-limit", () => ({
  isImageUploadBlocked: isImageUploadBlockedMock,
  recordImageUploadAttempt: recordImageUploadAttemptMock,
}));

import {
  DELETE as deletePartnerNotifications,
  PATCH as patchPartnerNotifications,
} from "../../src/app/api/partner/notifications/route";
import { POST as completeImageUpload } from "../../src/app/api/uploads/images/complete/route";
import { POST as signImageUpload } from "../../src/app/api/uploads/images/sign/route";
import { ImageUploadError } from "../../src/lib/image-upload/repository";

const ORIGIN = "https://ssartnership.example.com";
const PARTNER_NOTIFICATIONS_URL = `${ORIGIN}/api/partner/notifications`;
const IMAGE_SIGN_URL = `${ORIGIN}/api/uploads/images/sign`;
const IMAGE_COMPLETE_URL = `${ORIGIN}/api/uploads/images/complete`;

type RouteInvoker = (request: NextRequest) => Promise<Response>;

const invokePartnerNotificationPatch: RouteInvoker = async (request) =>
  (await patchPartnerNotifications(request))!;
const invokePartnerNotificationDelete: RouteInvoker = async (request) =>
  (await deletePartnerNotifications(request))!;
const invokeImageUploadSign: RouteInvoker = signImageUpload;
const invokeImageUploadComplete: RouteInvoker = completeImageUpload;

function createRequest(
  url: string,
  body: BodyInit,
  headers: Record<string, string> = {},
) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      ...headers,
    },
    body,
  });
}

function createStreamedRequest(url: string, maximumBytes: number) {
  const chunk = new TextEncoder().encode(
    "x".repeat(Math.floor(maximumBytes / 2) + 1),
  );
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(chunk);
      controller.enqueue(chunk);
      controller.close();
    },
  });

  return new NextRequest(
    url,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
      },
      body,
      duplex: "half",
    } as unknown as ConstructorParameters<typeof NextRequest>[1],
  );
}

describe("remaining bounded JSON routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTrustedSameOriginRequestMock.mockReturnValue(true);
    getPartnerSessionMock.mockResolvedValue({
      accountId: "partner-account-1",
      companyIds: ["partner-company-1"],
      displayName: "파트너",
      loginId: "partner",
      mustChangePassword: false,
    });
    markPartnerStoredNotificationsReadMock.mockResolvedValue({ unreadCount: 0 });
    deletePartnerStoredNotificationsMock.mockResolvedValue({ unreadCount: 0 });
    isImageUploadBlockedMock.mockResolvedValue({ ok: true, blocked: false });
    resolveImageUploadActorForRouteMock.mockResolvedValue({
      actor: { kind: "member", id: "member-1" },
    });
    imageUploadSignMock.mockResolvedValue([]);
    imageUploadCompleteMock.mockResolvedValue([]);
  });

  describe.each([
    {
      label: "파트너 알림 PATCH",
      maximumBytes: 16 * 1024,
      url: PARTNER_NOTIFICATIONS_URL,
      invoke: invokePartnerNotificationPatch,
      expectedBody: { message: "요청 본문이 너무 큽니다." },
    },
    {
      label: "파트너 알림 DELETE",
      maximumBytes: 16 * 1024,
      url: PARTNER_NOTIFICATIONS_URL,
      invoke: invokePartnerNotificationDelete,
      expectedBody: { message: "요청 본문이 너무 큽니다." },
    },
    {
      label: "이미지 sign",
      maximumBytes: 64 * 1024,
      url: IMAGE_SIGN_URL,
      invoke: invokeImageUploadSign,
      expectedBody: {
        ok: false,
        message: "이미지 업로드 요청이 너무 큽니다.",
      },
    },
    {
      label: "이미지 complete",
      maximumBytes: 32 * 1024,
      url: IMAGE_COMPLETE_URL,
      invoke: invokeImageUploadComplete,
      expectedBody: {
        ok: false,
        message: "이미지 업로드 요청이 너무 큽니다.",
      },
    },
  ])("$label", ({ expectedBody, invoke, maximumBytes, url }) => {
    it("선언된 Content-Length 초과를 413으로 거부한다", async () => {
      const response = await invoke(
        createRequest(url, "{}", {
          "content-length": String(maximumBytes + 1),
        }),
      );

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual(expectedBody);
      expect(markPartnerStoredNotificationsReadMock).not.toHaveBeenCalled();
      expect(deletePartnerStoredNotificationsMock).not.toHaveBeenCalled();
      expect(resolveImageUploadActorForRouteMock).not.toHaveBeenCalled();
      expect(isImageUploadBlockedMock).not.toHaveBeenCalled();
    });

    it("실제 streamed 본문 초과를 413으로 거부한다", async () => {
      const response = await invoke(createStreamedRequest(url, maximumBytes));

      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual(expectedBody);
      expect(markPartnerStoredNotificationsReadMock).not.toHaveBeenCalled();
      expect(deletePartnerStoredNotificationsMock).not.toHaveBeenCalled();
      expect(resolveImageUploadActorForRouteMock).not.toHaveBeenCalled();
      expect(isImageUploadBlockedMock).not.toHaveBeenCalled();
    });
  });

  it("파트너 알림은 malformed JSON과 선택값 검증 오류를 계속 400으로 구분한다", async () => {
    const malformedResponse = await invokePartnerNotificationPatch(
      createRequest(PARTNER_NOTIFICATIONS_URL, "{"),
    );
    expect(malformedResponse.status).toBe(400);
    await expect(malformedResponse.json()).resolves.toEqual({
      message: "요청 본문 형식을 확인해 주세요.",
    });

    const invalidSelectionResponse = await invokePartnerNotificationPatch(
      createRequest(
        PARTNER_NOTIFICATIONS_URL,
        JSON.stringify({ notificationIds: "not-an-array" }),
      ),
    );
    expect(invalidSelectionResponse.status).toBe(400);
    await expect(invalidSelectionResponse.json()).resolves.toEqual({
      message: "알림 선택값을 확인해 주세요.",
    });
    expect(markPartnerStoredNotificationsReadMock).not.toHaveBeenCalled();
  });

  it("파트너 알림은 본문 없는 기존 전체 처리 계약을 유지한다", async () => {
    const response = await invokePartnerNotificationPatch(
      new NextRequest(PARTNER_NOTIFICATIONS_URL, {
        method: "PATCH",
        headers: { origin: ORIGIN },
      }),
    );

    expect(response.status).toBe(200);
    expect(markPartnerStoredNotificationsReadMock).toHaveBeenCalledWith({
      accountId: "partner-account-1",
      notificationIds: null,
    });
  });

  it.each([
    ["sign", IMAGE_SIGN_URL, invokeImageUploadSign],
    ["complete", IMAGE_COMPLETE_URL, invokeImageUploadComplete],
  ] as const)("이미지 %s은 malformed JSON과 유효하지 않은 JSON 요청을 계속 400으로 거부한다", async (
    _label,
    url,
    invoke,
  ) => {
    const malformedResponse = await invoke(createRequest(url, "{"));
    expect(malformedResponse.status).toBe(400);
    await expect(malformedResponse.json()).resolves.toEqual({
      ok: false,
      message: "이미지 업로드 요청을 확인해 주세요.",
    });

    const invalidRequestResponse = await invoke(createRequest(url, "{}"));
    expect(invalidRequestResponse.status).toBe(400);
    await expect(invalidRequestResponse.json()).resolves.toEqual({
      ok: false,
      message: "이미지 업로드 요청을 확인해 주세요.",
    });
    expect(resolveImageUploadActorForRouteMock).not.toHaveBeenCalled();
    expect(isImageUploadBlockedMock).not.toHaveBeenCalled();
  });

  it("same-origin과 파트너 인증 검사를 본문 파싱보다 먼저 수행한다", async () => {
    isTrustedSameOriginRequestMock.mockReturnValueOnce(false);
    const untrustedResponse = await invokePartnerNotificationPatch(
      createRequest(PARTNER_NOTIFICATIONS_URL, "{"),
    );
    expect(untrustedResponse.status).toBe(403);
    expect(getPartnerSessionMock).not.toHaveBeenCalled();

    getPartnerSessionMock.mockResolvedValueOnce(null);
    const signedOutResponse = await invokePartnerNotificationPatch(
      createRequest(PARTNER_NOTIFICATIONS_URL, "{"),
    );
    expect(signedOutResponse.status).toBe(401);
    expect(markPartnerStoredNotificationsReadMock).not.toHaveBeenCalled();
  });

  it.each([
    ["sign", IMAGE_SIGN_URL, invokeImageUploadSign],
    ["complete", IMAGE_COMPLETE_URL, invokeImageUploadComplete],
  ] as const)("이미지 %s은 same-origin 검사를 본문 파싱보다 먼저 수행한다", async (
    _label,
    url,
    invoke,
  ) => {
    isTrustedSameOriginRequestMock.mockReturnValueOnce(false);
    const response = await invoke(createRequest(url, "{"));

    expect(response.status).toBe(403);
    expect(resolveImageUploadActorForRouteMock).not.toHaveBeenCalled();
    expect(isImageUploadBlockedMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "sign",
      IMAGE_SIGN_URL,
      invokeImageUploadSign,
      {
        purpose: "review",
        actorMode: "member",
        uploads: [
          {
            clientId: "review-image",
            role: "image",
            fileName: "review.webp",
            contentType: "image/webp",
            size: 1_024,
          },
        ],
      },
    ],
    [
      "complete",
      IMAGE_COMPLETE_URL,
      invokeImageUploadComplete,
      {
        purpose: "review",
        actorMode: "member",
        uploadIds: ["03f5459b-dfee-4558-907a-509a396312f5"],
      },
    ],
  ] as const)("이미지 %s은 rate-limit 저장소 실패 시 업로드 동작 전에 503으로 닫힌다", async (
    _label,
    url,
    invoke,
    body,
  ) => {
    isImageUploadBlockedMock.mockResolvedValueOnce({
      ok: false,
      code: "rate_limit_storage_failed",
    });

    const response = await invoke(
      createRequest(url, JSON.stringify(body)),
    );

    expect(response.status).toBe(503);
    expect(isImageUploadBlockedMock).toHaveBeenCalledTimes(1);
    expect(recordImageUploadAttemptMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "sign",
      IMAGE_SIGN_URL,
      invokeImageUploadSign,
      imageUploadSignMock,
      {
        purpose: "review",
        actorMode: "member",
        uploads: [{
          clientId: "review-image",
          role: "image",
          fileName: "review.webp",
          contentType: "image/webp",
          size: 1_024,
        }],
      },
    ],
    [
      "complete",
      IMAGE_COMPLETE_URL,
      invokeImageUploadComplete,
      imageUploadCompleteMock,
      {
        purpose: "review",
        actorMode: "member",
        uploadIds: ["03f5459b-dfee-4558-907a-509a396312f5"],
      },
    ],
  ] as const)("이미지 %s은 저장소 미지원 환경을 동일한 503 계약으로 알린다", async (
    _label,
    url,
    invoke,
    operation,
    body,
  ) => {
    operation.mockRejectedValueOnce(
      new ImageUploadError(
        "image_upload_unavailable",
        "현재 환경에서는 이미지 업로드를 사용할 수 없습니다.",
      ),
    );

    const response = await invoke(createRequest(url, JSON.stringify(body)));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "image_upload_unavailable",
      message: "현재 환경에서는 이미지 업로드를 사용할 수 없습니다.",
    });
  });
});
