export const REQUIRED_POLICY_KINDS = ["service", "privacy"] as const;
export const OPTIONAL_POLICY_KINDS = ["marketing"] as const;
export const POLICY_KINDS = [
  ...REQUIRED_POLICY_KINDS,
  ...OPTIONAL_POLICY_KINDS,
] as const;

export type RequiredPolicyKind = (typeof REQUIRED_POLICY_KINDS)[number];
export type PolicyKind = (typeof POLICY_KINDS)[number];

export type PolicyDocument = {
  id: string;
  kind: PolicyKind;
  version: number;
  title: string;
  summary: string | null;
  content: string;
  is_active: boolean;
  effective_at: string;
  created_at: string | null;
  updated_at: string | null;
};

export type MemberPolicyConsentVersions = Record<PolicyKind, number | null>;

export type MemberPolicyConsentRow = {
  kind: string;
  version: number;
  agreed_at: string | null;
};

export type RequiredPolicyMap = Record<RequiredPolicyKind, PolicyDocument>;

export type PolicyReviewItem = {
  policy: PolicyDocument;
  required: boolean;
};

export type MemberPolicyReviewBundle = {
  requiredPolicies: RequiredPolicyMap;
  reviewPolicies: PolicyReviewItem[];
};

export type PolicyDocumentErrorCode =
  | "db_error"
  | "not_found"
  | "invalid_request";

export class PolicyDocumentError extends Error {
  code: PolicyDocumentErrorCode;

  constructor(code: PolicyDocumentErrorCode, message: string) {
    super(message);
    this.name = "PolicyDocumentError";
    this.code = code;
  }
}

export function isPolicyKind(value: string): value is PolicyKind {
  return POLICY_KINDS.includes(value as PolicyKind);
}

export function isRequiredPolicyKind(value: string): value is RequiredPolicyKind {
  return REQUIRED_POLICY_KINDS.includes(value as RequiredPolicyKind);
}

export function getPolicyKindLabel(kind: PolicyKind) {
  return kind === "service"
    ? "서비스 이용약관"
    : kind === "privacy"
      ? "개인정보 수집·이용 및 처리방침"
      : "마케팅 정보 수신 동의";
}

export function getPolicyDescription(kind: PolicyKind) {
  if (kind === "service") {
    return "회원가입과 서비스 이용 조건을 안내합니다.";
  }
  if (kind === "privacy") {
    return "개인정보 수집, 이용, 보관 및 보호 기준을 안내합니다.";
  }
  return "제휴 소식, 혜택 안내, 이벤트 등 선택적 안내 수신 동의입니다.";
}

export function getPolicyHref(
  kind: PolicyKind,
  version?: number,
  returnTo?: string,
) {
  const base = `/legal/${kind}`;
  const searchParams = new URLSearchParams();
  if (typeof version === "number") {
    searchParams.set("version", String(version));
  }
  if (returnTo) {
    searchParams.set("returnTo", returnTo);
  }
  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
}

function createEmptyMemberPolicyConsentVersions(): MemberPolicyConsentVersions {
  return {
    service: null,
    privacy: null,
    marketing: null,
  };
}

export function getMemberPolicyConsentVersionsFromRows(
  rows: MemberPolicyConsentRow[] | null | undefined,
): MemberPolicyConsentVersions {
  const versions = createEmptyMemberPolicyConsentVersions();

  for (const row of rows ?? []) {
    const kind = row.kind;
    if (
      !row.agreed_at
      || !isPolicyKind(kind)
      || !Number.isInteger(row.version)
    ) {
      continue;
    }
    const previousVersion = versions[kind];
    if (previousVersion === null || row.version > previousVersion) {
      versions[kind] = row.version;
    }
  }

  return versions;
}

export function evaluateRequiredPolicyStatus(
  consentVersions: Partial<MemberPolicyConsentVersions> | null | undefined,
  activePolicies: RequiredPolicyMap,
) {
  const acceptedVersions: Record<RequiredPolicyKind, number | null> = {
    service:
      typeof consentVersions?.service === "number"
        ? consentVersions.service
        : null,
    privacy:
      typeof consentVersions?.privacy === "number"
        ? consentVersions.privacy
        : null,
  };

  const outdatedKinds = REQUIRED_POLICY_KINDS.filter(
    (kind) => acceptedVersions[kind] !== activePolicies[kind].version,
  );

  return {
    requiresConsent: outdatedKinds.length > 0,
    outdatedKinds,
    acceptedVersions,
  };
}

export function getSelectedPolicyValidationError(
  input: {
    servicePolicyId?: string | null;
    privacyPolicyId?: string | null;
    marketingPolicyId?: string | null;
    marketingPolicyChecked?: boolean;
  },
  activePolicies: RequiredPolicyMap,
  activeMarketingPolicy?: PolicyDocument | null,
) {
  if (input.servicePolicyId !== activePolicies.service.id) {
    return "서비스 이용약관이 변경되었습니다. 다시 확인 후 동의해 주세요.";
  }
  if (input.privacyPolicyId !== activePolicies.privacy.id) {
    return "개인정보 처리방침이 변경되었습니다. 다시 확인 후 동의해 주세요.";
  }
  if (input.marketingPolicyChecked) {
    if (!activeMarketingPolicy) {
      return "마케팅 정보 수신 동의 문서를 불러오지 못했습니다. 다시 시도해 주세요.";
    }
    if (input.marketingPolicyId !== activeMarketingPolicy.id) {
      return "마케팅 정보 수신 동의가 변경되었습니다. 다시 확인 후 동의해 주세요.";
    }
  }
  return null;
}
