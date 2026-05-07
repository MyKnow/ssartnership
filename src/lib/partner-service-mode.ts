export type PartnerServiceMode = "offline" | "online";

export const ONLINE_PARTNER_LOCATION = "온라인";

export function getPartnerServiceMode(
  location: string | null | undefined,
): PartnerServiceMode {
  return location?.trim() === ONLINE_PARTNER_LOCATION ? "online" : "offline";
}

export function isOnlinePartnerLocation(location: string | null | undefined) {
  return getPartnerServiceMode(location) === "online";
}

export function getPartnerLocationForServiceMode(
  mode: PartnerServiceMode,
  location: string,
) {
  return mode === "online" ? ONLINE_PARTNER_LOCATION : location.trim();
}

export function getPartnerPlaceLinkLabel(mode: PartnerServiceMode) {
  return mode === "online" ? "웹사이트 바로가기" : "지도 보기";
}
