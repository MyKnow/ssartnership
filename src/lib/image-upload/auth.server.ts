import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { canAdmin } from "@/lib/admin-permissions";
import { getAdminSession } from "@/lib/auth";
import {
  type ImageUploadActor,
  type ImageUploadOwnerKind,
} from "@/lib/image-upload/repository";
import type { ImageUploadPurpose } from "@/lib/image-upload/policy";
import { getGraduateApplicationSession } from "@/lib/graduate-verification-security";
import { getPartnerSession } from "@/lib/partner-session";
import { getSignedUserSession } from "@/lib/user-auth";

export const IMAGE_UPLOAD_GUEST_COOKIE = "image_upload_guest";
export const IMAGE_UPLOAD_GUEST_COOKIE_MAX_AGE_SECONDS = 2 * 60 * 60;

export type ImageUploadActorMode = "admin" | "member" | "partner" | "guest";

export class ImageUploadAuthorizationError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "ImageUploadAuthorizationError";
  }
}

function requireAdminPermission(
  session: Awaited<ReturnType<typeof getAdminSession>>,
  resource: Parameters<typeof canAdmin>[1],
  action: Parameters<typeof canAdmin>[2],
) {
  if (!session) {
    throw new ImageUploadAuthorizationError(401, "관리자 인증이 필요합니다.");
  }
  if (!canAdmin(session.account.permissions, resource, action)) {
    throw new ImageUploadAuthorizationError(403, "관리자 권한이 필요합니다.");
  }
  return { kind: "admin" as const, id: session.adminId };
}

async function getAdminActorForPurpose(purpose: ImageUploadPurpose) {
  const session = await getAdminSession();
  if (purpose === "promotion") {
    return requireAdminPermission(session, "home_ads", "update");
  }
  if (purpose === "manual-member-import") {
    return requireAdminPermission(session, "members", "create");
  }
  if (purpose === "profile") {
    return requireAdminPermission(session, "profile_images", "update");
  }
  if (purpose === "partner") {
    if (!session) {
      throw new ImageUploadAuthorizationError(401, "관리자 인증이 필요합니다.");
    }
    const permitted = canAdmin(session.account.permissions, "brands", "create")
      || canAdmin(session.account.permissions, "brands", "update");
    if (!permitted) {
      throw new ImageUploadAuthorizationError(403, "관리자 권한이 필요합니다.");
    }
    return { kind: "admin" as const, id: session.adminId };
  }
  throw new ImageUploadAuthorizationError(403, "이 이미지 업로드 용도는 관리자 권한을 지원하지 않습니다.");
}

async function getMemberActor() {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    throw new ImageUploadAuthorizationError(401, "로그인이 필요합니다.");
  }
  return { kind: "member" as const, id: session.userId };
}

async function getPartnerActor() {
  const session = await getPartnerSession();
  if (!session?.accountId || session.mustChangePassword) {
    throw new ImageUploadAuthorizationError(401, "파트너 인증이 필요합니다.");
  }
  return { kind: "partner" as const, id: session.accountId };
}

async function getGraduateActor() {
  const session = await getGraduateApplicationSession();
  if (!session?.challengeId) {
    throw new ImageUploadAuthorizationError(401, "이메일 인증을 다시 진행해 주세요.");
  }
  return { kind: "graduate_challenge" as const, id: session.challengeId };
}

function normalizeGuestOwner(value: string | undefined | null) {
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function resolveImageUploadActorForRoute(input: {
  purpose: ImageUploadPurpose;
  actorMode?: ImageUploadActorMode;
  guestOwner?: string | null;
}): Promise<{ actor: ImageUploadActor; guestOwnerToSet?: string }> {
  const { purpose, actorMode } = input;
  if (actorMode === "admin") {
    return { actor: await getAdminActorForPurpose(purpose) };
  }
  if (actorMode === "member") {
    return { actor: await getMemberActor() };
  }
  if (actorMode === "partner") {
    return { actor: await getPartnerActor() };
  }
  if (actorMode === "guest") {
    if (purpose !== "partner-registration") {
      throw new ImageUploadAuthorizationError(403, "게스트 이미지 업로드는 제휴 등록에서만 사용할 수 있습니다.");
    }
    const existing = normalizeGuestOwner(input.guestOwner);
    const guestOwner = existing ?? randomUUID();
    return {
      actor: { kind: "guest", id: guestOwner },
      ...(existing ? {} : { guestOwnerToSet: guestOwner }),
    };
  }

  switch (purpose) {
    case "partner":
    case "promotion":
    case "manual-member-import":
      return { actor: await getAdminActorForPurpose(purpose) };
    case "partner-change-request":
      return { actor: await getPartnerActor() };
    case "review":
      return { actor: await getMemberActor() };
    case "profile":
      return { actor: await getMemberActor() };
    case "graduate-verification":
      return { actor: await getGraduateActor() };
    case "partner-registration": {
      const partner = await getPartnerSession();
      if (partner?.accountId && !partner.mustChangePassword) {
        return { actor: { kind: "partner", id: partner.accountId } };
      }
      const existing = normalizeGuestOwner(input.guestOwner);
      const guestOwner = existing ?? randomUUID();
      return {
        actor: { kind: "guest", id: guestOwner },
        ...(existing ? {} : { guestOwnerToSet: guestOwner }),
      };
    }
  }
}

export async function resolveImageUploadActorForServerAction(
  purpose: ImageUploadPurpose,
  actorMode?: ImageUploadActorMode,
): Promise<ImageUploadActor> {
  if (actorMode === "admin") return getAdminActorForPurpose(purpose);
  if (actorMode === "member") return getMemberActor();
  if (actorMode === "partner") return getPartnerActor();
  if (actorMode === "guest") {
    const store = await cookies();
    const guestOwner = normalizeGuestOwner(store.get(IMAGE_UPLOAD_GUEST_COOKIE)?.value);
    if (!guestOwner) {
      throw new ImageUploadAuthorizationError(401, "이미지 업로드 세션이 만료되었습니다.");
    }
    return { kind: "guest", id: guestOwner };
  }
  if (purpose === "partner-registration") {
    const partner = await getPartnerSession();
    if (partner?.accountId && !partner.mustChangePassword) {
      return { kind: "partner", id: partner.accountId };
    }
    return resolveImageUploadActorForServerAction(purpose, "guest");
  }
  return (await resolveImageUploadActorForRoute({ purpose })).actor;
}

export function imageUploadActorIdentifier(actor: ImageUploadActor) {
  return `${actor.kind}:${actor.id}`;
}

export function isImageUploadOwnerKind(value: unknown): value is ImageUploadOwnerKind {
  return value === "admin"
    || value === "member"
    || value === "partner"
    || value === "graduate_challenge"
    || value === "guest";
}
