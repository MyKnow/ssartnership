import { formatKoreanDateTimeToMinute } from "@/lib/datetime";

export function formatPartnerAccountDateTime(value?: string | null) {
  if (!value) {
    return "없음";
  }

  return formatKoreanDateTimeToMinute(value);
}

export function buildPartnerInitialSetupUrl(token: string, siteUrl?: string) {
  return new URL(
    `/partner/setup/${token}`,
    siteUrl ?? "https://ssartnership.vercel.app",
  ).toString();
}
