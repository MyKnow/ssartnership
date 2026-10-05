import { isPartnerSetupLinkExpired } from "@/lib/partner-auth/setup-link";
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

export function hasIssuedPartnerInitialSetupLink(
  account: PartnerInitialSetupStateInput,
) {
  return Boolean(
    account.initial_setup_link_sent_at || account.initial_setup_expires_at,
  );
}

/**
 * Same expiry rule as the setup page (`getPartnerSetupLinkState`): a link sent
 * without a stored expiry is rejected there, so it must not look usable here
 * and the operator should reissue it.
 */
export function hasUsablePartnerInitialSetupLink(
  account: PartnerInitialSetupStateInput,
  now = new Date(),
) {
  if (account.initial_setup_completed_at) {
    return false;
  }

  return !isPartnerSetupLinkExpired(
    account.initial_setup_expires_at,
    now.getTime(),
  );
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

  if (!hasIssuedPartnerInitialSetupLink(account)) {
    return {
      variant: "neutral" as const,
      label: "초기설정 URL 미생성",
    };
  }

  if (!hasUsablePartnerInitialSetupLink(account, now)) {
    return {
      variant: "warning" as const,
      label: "초기설정 URL 만료됨",
    };
  }

  return {
    variant: "primary" as const,
    label: account.initial_setup_link_sent_at
      ? "초기설정 URL 전송됨"
      : "초기설정 URL 준비됨",
  };
}
