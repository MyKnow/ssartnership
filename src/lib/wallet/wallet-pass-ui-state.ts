import type { MemberWalletPass } from "@/lib/repositories/wallet-pass-repository";
import {
  getWalletPassEligibilityMessage,
  type WalletPassEligibility,
} from "@/lib/wallet/wallet-pass-eligibility";
import { buildMemberGateHref } from "@/lib/member-required-gates";
import type { AppleWalletCardStatus } from "@/lib/wallet/wallet-pass-card-state";

export type { AppleWalletCardStatus } from "@/lib/wallet/wallet-pass-card-state";

export function resolveAppleWalletCardState(input: {
  eligibility: WalletPassEligibility;
  configured: boolean;
  consentCurrent: boolean;
  snapshotStale: boolean;
  returnTo?: string;
  pass: Pick<
    MemberWalletPass,
    "credentialStatus" | "syncStatus" | "issuedAt"
  > | null;
}): {
  status: AppleWalletCardStatus;
  blockerMessage: string | null;
  blockerActionHref: string | null;
  blockerActionLabel: string | null;
  lastIssuedAt: string | null;
} {
  const lastIssuedAt = input.pass?.issuedAt ?? null;
  const gateReturnTo = input.returnTo ?? "/certification";

  if (!input.eligibility.eligible) {
    const action = (() => {
      switch (input.eligibility.reason) {
        case "password_change_required":
          return {
            href: buildMemberGateHref("change-password", gateReturnTo),
            label: "비밀번호 변경하기",
          };
        case "consent_required":
          return {
            href: buildMemberGateHref("consent", gateReturnTo),
            label: "필수 약관 동의하기",
          };
        case "profile_photo_missing":
        case "profile_photo_pending":
        case "profile_photo_rejected":
          return {
            href: buildMemberGateHref("profile-photo", gateReturnTo),
            label: "본인 사진 확인하기",
          };
        default:
          return null;
      }
    })();
    return {
      status: "blocked",
      blockerMessage: getWalletPassEligibilityMessage(input.eligibility.reason),
      blockerActionHref: action?.href ?? null,
      blockerActionLabel: action?.label ?? null,
      lastIssuedAt,
    };
  }
  if (
    !input.configured
    && input.pass?.credentialStatus === "active"
  ) {
    return {
      status: "active_unavailable",
      blockerMessage: null,
      blockerActionHref: null,
      blockerActionLabel: null,
      lastIssuedAt,
    };
  }
  if (!input.configured) {
    return {
      status: "unavailable",
      blockerMessage: null,
      blockerActionHref: null,
      blockerActionLabel: null,
      lastIssuedAt,
    };
  }
  if (input.pass?.credentialStatus === "revoked") {
    return {
      status: "revoked",
      blockerMessage: null,
      blockerActionHref: null,
      blockerActionLabel: null,
      lastIssuedAt,
    };
  }
  if (input.pass && !input.consentCurrent) {
    return {
      status: "consent_required",
      blockerMessage: null,
      blockerActionHref: null,
      blockerActionLabel: null,
      lastIssuedAt,
    };
  }
  if (input.snapshotStale || input.pass?.syncStatus === "failed") {
    return {
      status: "error",
      blockerMessage:
        input.snapshotStale
          ? "회원 정보가 변경되었어요. 패스를 다시 받으면 최신 정보로 갱신됩니다."
          : "기기 갱신 중 문제가 발생했어요. 패스를 다시 받으면 최신 정보로 갱신됩니다.",
      blockerActionHref: null,
      blockerActionLabel: null,
      lastIssuedAt,
    };
  }
  if (input.pass?.credentialStatus === "active") {
    return {
      status: "active",
      blockerMessage: null,
      blockerActionHref: null,
      blockerActionLabel: null,
      lastIssuedAt,
    };
  }
  return {
    status: "not_issued",
    blockerMessage: null,
    blockerActionHref: null,
    blockerActionLabel: null,
    lastIssuedAt,
  };
}
