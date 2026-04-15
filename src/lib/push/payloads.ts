import { SITE_URL } from "../site.ts";
import { sanitizeHttpUrl } from "../validation.ts";
import { PushError } from "./types.ts";
import type { PushNotificationType, PushPayload } from "./types.ts";

export function getPreferenceKey(type: PushNotificationType) {
  switch (type) {
    case "announcement":
      return "announcementEnabled" as const;
    case "new_partner":
      return "newPartnerEnabled" as const;
    case "expiring_partner":
      return "expiringPartnerEnabled" as const;
  }
}

export function sanitizeNotificationUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  return sanitizeHttpUrl(trimmed);
}

function toAbsoluteUrl(url?: string | null) {
  if (!url) {
    return `${SITE_URL}/`;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return new URL(url, SITE_URL).toString();
}

export function buildNotificationPayload(payload: PushPayload) {
  return JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    tag: payload.tag ?? `${payload.type}-${Date.now()}`,
    type: payload.type,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  });
}

export function createAnnouncementPayload(params: {
  title: string;
  body: string;
  url?: string | null;
}) {
  const title = params.title.trim();
  const body = params.body.trim();
  if (!title || !body) {
    throw new PushError("invalid_request", "제목과 내용을 모두 입력해 주세요.");
  }

  const safeUrl = sanitizeNotificationUrl(params.url);
  if (params.url?.trim() && !safeUrl) {
    throw new PushError("invalid_request", "알림 이동 URL 형식을 확인해 주세요.");
  }

  return {
    type: "announcement" as const,
    title,
    body,
    url: safeUrl,
    tag: `announcement-${Date.now()}`,
  };
}

export function createNewPartnerPayload(params: {
  partnerId: string;
  name: string;
  location: string;
  categoryLabel?: string | null;
}) {
  const place = params.location.trim();
  return {
    type: "new_partner" as const,
    title: `신규 제휴: ${params.name}`,
    body: params.categoryLabel
      ? `${params.categoryLabel} 카테고리에 새 제휴가 등록되었습니다. ${place}`
      : `새 제휴 업체가 등록되었습니다. ${place}`,
    url: `/partners/${params.partnerId}`,
    tag: `new-partner-${params.partnerId}`,
  };
}

export function createExpiringPartnerPayload(params: {
  partnerId: string;
  name: string;
  endDate: string;
}) {
  return {
    type: "expiring_partner" as const,
    title: `곧 종료: ${params.name}`,
    body: `${params.endDate}에 제휴 혜택이 종료됩니다.`,
    url: `/partners/${params.partnerId}`,
    tag: `expiring-partner-${params.partnerId}`,
  };
}

export function getPushDestinationLabel(url?: string | null) {
  const safeUrl = sanitizeNotificationUrl(url);
  if (!safeUrl) {
    return toAbsoluteUrl("/");
  }
  return toAbsoluteUrl(safeUrl);
}
