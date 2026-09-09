import { createHash } from "node:crypto";
import { parseSsafyProfile } from "@/lib/mm-profile";
import {
  evaluateRequiredPolicyStatus,
  getActiveRequiredPolicies,
  getMemberPolicyConsentVersions,
} from "@/lib/policy-documents.server";
import {
  getMemberCanonicalProfile,
  type MemberCanonicalProfile,
} from "@/lib/member-profile-view";

export const APPLE_WALLET_PILOT_GENERATION = 15;

export type WalletPassEligibilityReason =
  | "member_not_found"
  | "password_change_required"
  | "consent_required"
  | "profile_photo_missing"
  | "profile_photo_pending"
  | "profile_photo_rejected"
  | "audience_ineligible";

export type WalletPassEligibility =
  | { eligible: true; member: MemberCanonicalProfile }
  | {
      eligible: false;
      reason: WalletPassEligibilityReason;
      member: MemberCanonicalProfile | null;
    };

export type WalletPassDisplaySnapshot = {
  displayName: string;
  generationLabel: string;
  campusLabel: string;
  roleLabel: string;
};

export function evaluateWalletPassEligibility(input: {
  member: MemberCanonicalProfile | null;
  requiresConsent: boolean;
}): WalletPassEligibility {
  const { member } = input;
  if (!member) {
    return { eligible: false, reason: "member_not_found", member: null };
  }
  if (member.mustChangePassword) {
    return { eligible: false, reason: "password_change_required", member };
  }
  if (input.requiresConsent) {
    return { eligible: false, reason: "consent_required", member };
  }
  if (member.profilePhotoReviewStatus !== "approved") {
    return {
      eligible: false,
      reason: `profile_photo_${member.profilePhotoReviewStatus}` as Extract<
        WalletPassEligibilityReason,
        | "profile_photo_missing"
        | "profile_photo_pending"
        | "profile_photo_rejected"
      >,
      member,
    };
  }
  const isPilotStudent =
    member.generation === APPLE_WALLET_PILOT_GENERATION &&
    !member.graduateVerifiedAt;
  const isStaff = member.generation === 0 && !member.graduateVerifiedAt;
  if (!isPilotStudent && !isStaff) {
    return { eligible: false, reason: "audience_ineligible", member };
  }
  return { eligible: true, member };
}

export async function getMemberWalletPassEligibility(
  memberId: string,
): Promise<WalletPassEligibility> {
  const [member, activePolicies, consentVersions] = await Promise.all([
    getMemberCanonicalProfile(memberId),
    getActiveRequiredPolicies(),
    getMemberPolicyConsentVersions(memberId),
  ]);
  const policyStatus = evaluateRequiredPolicyStatus(
    consentVersions,
    activePolicies,
  );
  return evaluateWalletPassEligibility({
    member,
    requiresConsent: policyStatus.requiresConsent,
  });
}

export function buildWalletPassDisplaySnapshot(
  member: MemberCanonicalProfile,
): WalletPassDisplaySnapshot {
  const profile = parseSsafyProfile(
    member.displayName ?? member.mattermostUsername ?? "",
  );
  const displayName =
    profile.displayName?.trim() || member.displayName?.trim() || "이름 미지정";
  return {
    displayName,
    generationLabel:
      member.generation && member.generation > 0
        ? `${member.generation}기`
        : "운영진",
    campusLabel: member.campus?.trim() || profile.campus?.trim() || "캠퍼스 미지정",
    roleLabel: member.generation === 0 ? "운영진" : "교육생",
  };
}

export function hashWalletPassDisplaySnapshot(
  snapshot: WalletPassDisplaySnapshot,
) {
  return createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
}

export function getWalletPassEligibilityMessage(
  reason: WalletPassEligibilityReason,
) {
  switch (reason) {
    case "password_change_required":
      return "비밀번호 변경을 먼저 완료해 주세요.";
    case "consent_required":
      return "필수 약관 동의를 먼저 완료해 주세요.";
    case "profile_photo_missing":
      return "본인 사진을 제출한 뒤 패스를 발급할 수 있어요.";
    case "profile_photo_pending":
      return "본인 사진 검토가 끝나면 패스를 발급할 수 있어요.";
    case "profile_photo_rejected":
      return "본인 사진을 다시 제출한 뒤 패스를 발급할 수 있어요.";
    case "audience_ineligible":
      return "현재 Apple Wallet 파일럿 대상이 아니에요.";
    default:
      return "회원 인증 상태를 확인할 수 없어요.";
  }
}
