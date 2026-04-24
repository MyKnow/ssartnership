import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const REQUIRED_POLICY_KINDS = ["service", "privacy"] as const;
export const OPTIONAL_POLICY_KINDS = ["marketing"] as const;
export const POLICY_KINDS = [...REQUIRED_POLICY_KINDS, ...OPTIONAL_POLICY_KINDS] as const;

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

export type MemberPolicyVersionFields = {
  service_policy_version?: number | null;
  service_policy_consented_at?: string | null;
  privacy_policy_version?: number | null;
  privacy_policy_consented_at?: string | null;
  marketing_policy_version?: number | null;
  marketing_policy_consented_at?: string | null;
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

const POLICY_SELECT =
  "id,kind,version,title,summary,content,is_active,effective_at,created_at,updated_at";

const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;
const hasSupabaseAdminEnv = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const useMockPolicies = dataSource === "mock" || !hasSupabaseAdminEnv;

const mockPolicyDocuments: PolicyDocument[] = [
  {
    id: "mock-policy-service-v1",
    kind: "service",
    version: 1,
    title: "서비스 이용약관",
    summary: "싸트너십 서비스 이용 조건을 안내합니다.",
    content:
      "싸트너십은 SSAFY 구성원이 제휴 혜택을 확인하고 이용할 수 있도록 정보를 제공합니다.",
    is_active: true,
    effective_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "mock-policy-privacy-v1",
    kind: "privacy",
    version: 1,
    title: "개인정보 처리방침",
    summary: "회원 인증과 서비스 제공에 필요한 개인정보 처리 기준입니다.",
    content:
      "회원 인증, 제휴 혜택 제공, 문의 처리를 위해 필요한 최소한의 개인정보를 처리합니다.",
    is_active: true,
    effective_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "mock-policy-marketing-v1",
    kind: "marketing",
    version: 1,
    title: "마케팅 정보 수신 동의",
    summary: "제휴 소식과 이벤트 안내 수신 동의입니다.",
    content:
      "신규 제휴, 혜택 변경, 이벤트 소식을 선택적으로 안내받을 수 있습니다.",
    is_active: true,
    effective_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

function wrapPolicyDocumentDbError(
  error: { message?: string | null } | null | undefined,
  message = "정책 문서를 처리하지 못했습니다.",
) {
  return new PolicyDocumentError(
    "db_error",
    error?.message?.trim() || message,
  );
}

async function queryActiveRequiredPolicies(): Promise<RequiredPolicyMap> {
  if (useMockPolicies) {
    return Object.fromEntries(
      REQUIRED_POLICY_KINDS.map((kind) => [
        kind,
        mockPolicyDocuments.find((policy) => policy.kind === kind)!,
      ]),
    ) as RequiredPolicyMap;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("policy_documents")
    .select(POLICY_SELECT)
    .in("kind", [...REQUIRED_POLICY_KINDS])
    .eq("is_active", true);

  if (error) {
    throw wrapPolicyDocumentDbError(
      error,
      "활성 정책 문서를 불러오지 못했습니다.",
    );
  }

  const policies = (data ?? []).filter((entry): entry is PolicyDocument =>
    isRequiredPolicyKind(String(entry.kind)),
  );

  const policyMap = {} as Partial<RequiredPolicyMap>;
  for (const policy of policies) {
    if (!isRequiredPolicyKind(policy.kind)) {
      continue;
    }
    if (!policyMap[policy.kind] || policy.version > policyMap[policy.kind]!.version) {
      policyMap[policy.kind] = policy;
    }
  }

  for (const kind of REQUIRED_POLICY_KINDS) {
    if (!policyMap[kind]) {
      throw new PolicyDocumentError(
        "not_found",
        `${getPolicyKindLabel(kind)}의 활성 버전이 없습니다.`,
      );
    }
  }

  return policyMap as RequiredPolicyMap;
}

export async function getActiveRequiredPolicies() {
  // 인증/동의 가드는 현재 활성 버전과 즉시 일치해야 하므로 캐시하지 않는다.
  return queryActiveRequiredPolicies();
}

async function queryPolicyDocumentByKind(
  kind: PolicyKind,
  version?: number | null,
) {
  if (useMockPolicies) {
    return (
      mockPolicyDocuments.find(
        (policy) =>
          policy.kind === kind &&
          (typeof version === "number" ? policy.version === version : policy.is_active),
      ) ?? null
    );
  }

  const supabase = getSupabaseAdminClient();
  const query = supabase
    .from("policy_documents")
    .select(POLICY_SELECT)
    .eq("kind", kind)
    .order("version", { ascending: false })
    .limit(1);

  const { data, error } = await (typeof version === "number"
    ? query.eq("version", version).maybeSingle()
    : query.eq("is_active", true).maybeSingle());
  if (error) {
    throw wrapPolicyDocumentDbError(
      error,
      "정책 문서를 불러오지 못했습니다.",
    );
  }

  if (!data || !isPolicyKind(String(data.kind))) {
    return null;
  }

  return data as PolicyDocument;
}

export async function getPolicyDocumentByKind(
  kind: PolicyKind,
  version?: number | null,
) {
  return queryPolicyDocumentByKind(kind, version);
}

export async function getPolicyDocumentsByKind(kind: PolicyKind) {
  if (useMockPolicies) {
    return mockPolicyDocuments
      .filter((policy) => policy.kind === kind)
      .sort((a, b) => b.version - a.version);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("policy_documents")
    .select(POLICY_SELECT)
    .eq("kind", kind)
    .order("version", { ascending: false });

  if (error) {
    throw wrapPolicyDocumentDbError(
      error,
      "정책 문서 이력을 불러오지 못했습니다.",
    );
  }

  return (data ?? []).filter((entry): entry is PolicyDocument =>
    isPolicyKind(String(entry.kind)),
  );
}

export async function getMemberPolicyReviewBundle(
  memberId: string,
): Promise<MemberPolicyReviewBundle> {
  const supabase = getSupabaseAdminClient();
  const [requiredPolicies, marketingPolicy, memberResult] = await Promise.all([
    getActiveRequiredPolicies(),
    getPolicyDocumentByKind("marketing"),
    supabase
      .from("members")
      .select(
        "service_policy_version,privacy_policy_version,marketing_policy_version",
      )
      .eq("id", memberId)
      .maybeSingle(),
  ]);

  if (memberResult.error) {
    throw wrapPolicyDocumentDbError(
      memberResult.error,
      "회원 정책 상태를 불러오지 못했습니다.",
    );
  }

  if (!memberResult.data) {
    throw new PolicyDocumentError(
      "not_found",
      "회원 정책 상태를 확인하지 못했습니다.",
    );
  }

  const reviewPolicies: PolicyReviewItem[] = [];

  for (const kind of REQUIRED_POLICY_KINDS) {
    const acceptedVersion =
      kind === "service"
        ? memberResult.data.service_policy_version
        : memberResult.data.privacy_policy_version;
    if (acceptedVersion !== requiredPolicies[kind].version) {
      reviewPolicies.push({ policy: requiredPolicies[kind], required: true });
    }
  }

  if (
    marketingPolicy &&
    memberResult.data.marketing_policy_version !== marketingPolicy.version
  ) {
    reviewPolicies.push({ policy: marketingPolicy, required: false });
  }

  return {
    requiredPolicies,
    reviewPolicies,
  };
}

export function evaluateRequiredPolicyStatus(
  member: MemberPolicyVersionFields | null | undefined,
  activePolicies: RequiredPolicyMap,
) {
  const acceptedVersions: Record<RequiredPolicyKind, number | null> = {
    service:
      typeof member?.service_policy_version === "number"
        ? member.service_policy_version
        : null,
    privacy:
      typeof member?.privacy_policy_version === "number"
        ? member.privacy_policy_version
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

export async function getMemberRequiredPolicyStatus(memberId: string) {
  const supabase = getSupabaseAdminClient();
  const [activePolicies, memberResult] = await Promise.all([
    getActiveRequiredPolicies(),
    supabase
      .from("members")
      .select(
        "service_policy_version,service_policy_consented_at,privacy_policy_version,privacy_policy_consented_at",
      )
      .eq("id", memberId)
      .maybeSingle(),
  ]);

  if (memberResult.error) {
    throw wrapPolicyDocumentDbError(
      memberResult.error,
      "회원 정책 상태를 확인하지 못했습니다.",
    );
  }

  return {
    activePolicies,
    ...evaluateRequiredPolicyStatus(memberResult.data, activePolicies),
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

export async function recordMarketingPolicyConsent(input: {
  memberId: string;
  activePolicy: PolicyDocument | null;
  agreed: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const agreedAt = new Date().toISOString();
  const { upsertMemberPushPreferences } = await import("@/lib/push/preferences");

  if (!input.agreed) {
    const [{ error }, pushPreferences] = await Promise.all([
      supabase
        .from("members")
        .update({
          marketing_policy_version: null,
          marketing_policy_consented_at: null,
          updated_at: agreedAt,
        })
        .eq("id", input.memberId),
      upsertMemberPushPreferences(input.memberId, { marketingEnabled: false }),
    ]);

    if (error) {
      throw wrapPolicyDocumentDbError(
        error,
        "회원 마케팅 동의 정보를 갱신하지 못했습니다.",
      );
    }

    if (!pushPreferences) {
      throw new PolicyDocumentError(
        "db_error",
        "회원 마케팅 알림 설정을 갱신하지 못했습니다.",
      );
    }

    return null;
  }

  if (!input.activePolicy) {
    throw new PolicyDocumentError(
      "not_found",
      "마케팅 정보 수신 동의의 활성 버전이 없습니다.",
    );
  }

  const [row] = [
    {
      member_id: input.memberId,
      policy_document_id: input.activePolicy.id,
      kind: input.activePolicy.kind,
      version: input.activePolicy.version,
      agreed_at: agreedAt,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    },
  ];

  const [{ error: consentError }, { error: updateError }, pushPreferences] =
    await Promise.all([
      supabase.from("member_policy_consents").upsert([row], {
        onConflict: "member_id,policy_document_id",
      }),
      supabase
        .from("members")
        .update({
          marketing_policy_version: input.activePolicy.version,
          marketing_policy_consented_at: agreedAt,
          updated_at: agreedAt,
        })
        .eq("id", input.memberId),
      upsertMemberPushPreferences(input.memberId, { marketingEnabled: true }),
    ]);

  if (consentError) {
    throw wrapPolicyDocumentDbError(
      consentError,
      "회원 마케팅 동의 내역을 저장하지 못했습니다.",
    );
  }
  if (updateError) {
    throw wrapPolicyDocumentDbError(
      updateError,
      "회원 마케팅 동의 정보를 갱신하지 못했습니다.",
    );
  }
  if (!pushPreferences) {
    throw new PolicyDocumentError(
      "db_error",
      "회원 마케팅 알림 설정을 갱신하지 못했습니다.",
    );
  }

  return agreedAt;
}

export async function recordRequiredPolicyConsent(input: {
  memberId: string;
  activePolicies: RequiredPolicyMap;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const agreedAt = new Date().toISOString();
  const rows = REQUIRED_POLICY_KINDS.map((kind) => ({
    member_id: input.memberId,
    policy_document_id: input.activePolicies[kind].id,
    kind,
    version: input.activePolicies[kind].version,
    agreed_at: agreedAt,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  }));

  const [{ error: consentError }, { error: updateError }] = await Promise.all([
    supabase.from("member_policy_consents").upsert(rows, {
      onConflict: "member_id,policy_document_id",
    }),
    supabase
      .from("members")
      .update({
        service_policy_version: input.activePolicies.service.version,
        service_policy_consented_at: agreedAt,
        privacy_policy_version: input.activePolicies.privacy.version,
        privacy_policy_consented_at: agreedAt,
        updated_at: agreedAt,
      })
      .eq("id", input.memberId),
  ]);

  if (consentError) {
    throw wrapPolicyDocumentDbError(
      consentError,
      "정책 동의 내역을 저장하지 못했습니다.",
    );
  }
  if (updateError) {
    throw wrapPolicyDocumentDbError(
      updateError,
      "회원 정책 동의 정보를 갱신하지 못했습니다.",
    );
  }

  return agreedAt;
}
