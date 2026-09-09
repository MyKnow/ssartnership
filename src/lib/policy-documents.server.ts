import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getMockMemberById,
  getMockMemberPolicyState,
  recordMockMarketingPolicyConsent,
  recordMockRequiredPolicyConsent,
} from "@/lib/mock/member";
import {
  assertRuntimeDataAccessAvailable,
  selectRuntimeDataAccess,
} from "@/lib/runtime-data-access";
import {
  evaluateRequiredPolicyStatus,
  getMemberPolicyConsentVersionsFromRows,
  getPolicyKindLabel,
  isPolicyKind,
  isRequiredPolicyKind,
  PolicyDocumentError,
  REQUIRED_POLICY_KINDS,
  type MemberPolicyConsentRow,
  type MemberPolicyConsentVersions,
  type MemberPolicyReviewBundle,
  type PolicyDocument,
  type PolicyKind,
  type PolicyReviewItem,
  type RequiredPolicyMap,
} from "@/lib/policy-documents";

export * from "@/lib/policy-documents";

const POLICY_SELECT =
  "id,kind,version,title,summary,content,is_active,effective_at,created_at,updated_at";
const MEMBER_POLICY_CONSENT_SELECT = "kind,version,agreed_at";

export const policyDocumentDataAccess = selectRuntimeDataAccess({
  capability: "admin",
});
const useMockPolicies = policyDocumentDataAccess.source === "mock";

function assertPolicyDocumentDataAccessAvailable() {
  assertRuntimeDataAccessAvailable(
    policyDocumentDataAccess,
    "정책 문서 저장소를 사용할 수 없습니다.",
  );
}

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

export async function getMemberPolicyConsentVersions(memberId: string) {
  assertPolicyDocumentDataAccessAvailable();
  if (useMockPolicies) {
    const state = getMockMemberPolicyState(memberId);
    if (!state) {
      throw new PolicyDocumentError(
        "not_found",
        "회원 정책 동의 내역을 확인하지 못했습니다.",
      );
    }
    return {
      service: state.service,
      privacy: state.privacy,
      marketing: state.marketing,
    } satisfies MemberPolicyConsentVersions;
  }

  const { data, error } = await getSupabaseAdminClient()
    .from("member_policy_consents")
    .select(MEMBER_POLICY_CONSENT_SELECT)
    .eq("member_id", memberId);
  if (error) {
    throw wrapPolicyDocumentDbError(
      error,
      "회원 정책 동의 내역을 불러오지 못했습니다.",
    );
  }

  return getMemberPolicyConsentVersionsFromRows(
    (data ?? []) as MemberPolicyConsentRow[],
  );
}

async function queryActiveRequiredPolicies(): Promise<RequiredPolicyMap> {
  assertPolicyDocumentDataAccessAvailable();
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
  assertPolicyDocumentDataAccessAvailable();
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
  assertPolicyDocumentDataAccessAvailable();
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
  const [requiredPolicies, marketingPolicy, consentVersions] = await Promise.all([
    getActiveRequiredPolicies(),
    getPolicyDocumentByKind("marketing"),
    getMemberPolicyConsentVersions(memberId),
  ]);

  if (!useMockPolicies) {
    const { data: member, error } = await getSupabaseAdminClient()
      .from("members")
      .select("id")
      .eq("id", memberId)
      .maybeSingle();
    if (error) {
      throw wrapPolicyDocumentDbError(
        error,
        "회원 정책 상태를 불러오지 못했습니다.",
      );
    }
    if (!member) {
      throw new PolicyDocumentError(
        "not_found",
        "회원 정책 상태를 확인하지 못했습니다.",
      );
    }
  } else if (!getMockMemberById(memberId)) {
    throw new PolicyDocumentError(
      "not_found",
      "회원 정책 상태를 확인하지 못했습니다.",
    );
  }

  const reviewPolicies: PolicyReviewItem[] = [];

  for (const kind of REQUIRED_POLICY_KINDS) {
    if (consentVersions[kind] !== requiredPolicies[kind].version) {
      reviewPolicies.push({ policy: requiredPolicies[kind], required: true });
    }
  }

  if (
    marketingPolicy &&
    consentVersions.marketing !== marketingPolicy.version
  ) {
    reviewPolicies.push({ policy: marketingPolicy, required: false });
  }

  return {
    requiredPolicies,
    reviewPolicies,
  };
}

export async function getMemberRequiredPolicyStatus(memberId: string) {
  const [activePolicies, consentVersions] = await Promise.all([
    getActiveRequiredPolicies(),
    getMemberPolicyConsentVersions(memberId),
  ]);

  if (!useMockPolicies) {
    const { data: member, error } = await getSupabaseAdminClient()
      .from("members")
      .select("id")
      .eq("id", memberId)
      .maybeSingle();
    if (error) {
      throw wrapPolicyDocumentDbError(
        error,
        "회원 정책 상태를 확인하지 못했습니다.",
      );
    }
    if (!member) {
      throw new PolicyDocumentError(
        "not_found",
        "회원 정책 상태를 확인하지 못했습니다.",
      );
    }
  } else if (!getMockMemberById(memberId)) {
    throw new PolicyDocumentError(
      "not_found",
      "회원 정책 상태를 확인하지 못했습니다.",
    );
  }

  return {
    activePolicies,
    ...evaluateRequiredPolicyStatus(consentVersions, activePolicies),
  };
}

export async function recordMarketingPolicyConsent(input: {
  memberId: string;
  activePolicy: PolicyDocument | null;
  agreed: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  assertPolicyDocumentDataAccessAvailable();
  const agreedAt = new Date().toISOString();

  if (useMockPolicies) {
    if (input.agreed && !input.activePolicy) {
      throw new PolicyDocumentError(
        "not_found",
        "마케팅 정보 수신 동의의 활성 버전이 없습니다.",
      );
    }
    recordMockMarketingPolicyConsent(
      input.memberId,
      input.activePolicy?.version ?? null,
      input.agreed,
    );
    return input.agreed ? agreedAt : null;
  }

  const { upsertMemberPushPreferences } = await import("@/lib/push/preferences");
  const supabase = getSupabaseAdminClient();

  if (!input.agreed) {
    const pushPreferences = await upsertMemberPushPreferences(input.memberId, {
      marketingEnabled: false,
    });

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

  const [{ error: consentError }, pushPreferences] = await Promise.all([
    supabase.from("member_policy_consents").upsert([row], {
      onConflict: "member_id,policy_document_id",
    }),
    upsertMemberPushPreferences(input.memberId, { marketingEnabled: true }),
  ]);

  if (consentError) {
    throw wrapPolicyDocumentDbError(
      consentError,
      "회원 마케팅 동의 내역을 저장하지 못했습니다.",
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
  assertPolicyDocumentDataAccessAvailable();
  if (useMockPolicies) {
    recordMockRequiredPolicyConsent(input.memberId, {
      service: input.activePolicies.service.version,
      privacy: input.activePolicies.privacy.version,
    });
    return new Date().toISOString();
  }

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

  const { error: consentError } = await supabase
    .from("member_policy_consents")
    .upsert(rows, {
      onConflict: "member_id,policy_document_id",
    });

  if (consentError) {
    throw wrapPolicyDocumentDbError(
      consentError,
      "정책 동의 내역을 저장하지 못했습니다.",
    );
  }
  return agreedAt;
}
