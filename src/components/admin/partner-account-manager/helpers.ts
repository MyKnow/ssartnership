export function formatPartnerAccountDateTime(value?: string | null) {
  if (!value) {
    return "없음";
  }

  return new Date(value).toLocaleString("ko-KR", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildPartnerInitialSetupUrl(token: string, siteUrl?: string) {
  return new URL(
    `/partner/setup/${token}`,
    siteUrl ?? "https://ssartnership.vercel.app",
  ).toString();
}
