import { formatKoreanDateTimeToMinute } from "@/lib/datetime";

type PartnerInitialSetupStateInput = {
  initial_setup_completed_at?: string | null;
  initial_setup_link_sent_at?: string | null;
  initial_setup_expires_at?: string | null;
};

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

function isFutureDate(value: string, now: Date) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now.getTime();
}

export function hasIssuedPartnerInitialSetupLink(
  account: PartnerInitialSetupStateInput,
) {
  return Boolean(
    account.initial_setup_link_sent_at || account.initial_setup_expires_at,
  );
}

export function hasUsablePartnerInitialSetupLink(
  account: PartnerInitialSetupStateInput,
  now = new Date(),
) {
  if (account.initial_setup_completed_at) {
    return false;
  }

  if (account.initial_setup_expires_at) {
    return isFutureDate(account.initial_setup_expires_at, now);
  }

  return Boolean(account.initial_setup_link_sent_at);
}

export function getPartnerInitialSetupBadge(
  account: PartnerInitialSetupStateInput,
  now = new Date(),
) {
  if (account.initial_setup_completed_at) {
    return {
      variant: "success" as const,
      label: "초기 설정 완료",
    };
  }

  if (account.initial_setup_expires_at) {
    const isAvailable = hasUsablePartnerInitialSetupLink(account, now);
    return {
      variant: isAvailable ? ("primary" as const) : ("warning" as const),
      label: isAvailable
        ? account.initial_setup_link_sent_at
          ? "초기설정 URL 전송됨"
          : "초기설정 URL 준비됨"
        : "초기설정 URL 만료됨",
    };
  }

  if (account.initial_setup_link_sent_at) {
    return {
      variant: "primary" as const,
      label: "초기설정 URL 전송됨",
    };
  }

  return {
    variant: "neutral" as const,
    label: "초기설정 URL 미생성",
  };
}
