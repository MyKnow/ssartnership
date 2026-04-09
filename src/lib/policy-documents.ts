import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const REQUIRED_POLICY_KINDS = ["service", "privacy"] as const;

export type PolicyKind = (typeof REQUIRED_POLICY_KINDS)[number];

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
};

export type RequiredPolicyMap = Record<PolicyKind, PolicyDocument>;

export function isPolicyKind(value: string): value is PolicyKind {
  return REQUIRED_POLICY_KINDS.includes(value as PolicyKind);
}

export function getPolicyKindLabel(kind: PolicyKind) {
  return kind === "service"
    ? "서비스 이용약관"
    : "개인정보 수집·이용 및 처리방침";
}

export function getPolicyFooterLabel(kind: PolicyKind) {
  return kind === "service" ? "서비스 이용약관" : "개인정보 처리방침";
}

export function getPolicyDescription(kind: PolicyKind) {
  return kind === "service"
    ? "회원가입과 서비스 이용 조건을 안내합니다."
    : "개인정보 수집, 이용, 보관 및 보호 기준을 안내합니다.";
}

export function getPolicyHref(kind: PolicyKind, version?: number) {
  const base = `/legal/${kind}`;
  return typeof version === "number" ? `${base}?version=${version}` : base;
}

const POLICY_SELECT =
  "id,kind,version,title,summary,content,is_active,effective_at,created_at,updated_at";

export async function getActiveRequiredPolicies() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("policy_documents")
    .select(POLICY_SELECT)
    .in("kind", [...REQUIRED_POLICY_KINDS])
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  const policies = (data ?? []).filter((entry): entry is PolicyDocument =>
    isPolicyKind(String(entry.kind)),
  );

  const policyMap = {} as Partial<RequiredPolicyMap>;
  for (const policy of policies) {
    if (!policyMap[policy.kind] || policy.version > policyMap[policy.kind]!.version) {
      policyMap[policy.kind] = policy;
    }
  }

  for (const kind of REQUIRED_POLICY_KINDS) {
    if (!policyMap[kind]) {
      throw new Error(`${getPolicyKindLabel(kind)}의 활성 버전이 없습니다.`);
    }
  }

  return policyMap as RequiredPolicyMap;
}

export async function getPolicyDocumentByKind(
  kind: PolicyKind,
  version?: number | null,
) {
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
    throw new Error(error.message);
  }

  if (!data || !isPolicyKind(String(data.kind))) {
    return null;
  }

  return data as PolicyDocument;
}

export function evaluateRequiredPolicyStatus(
  member: MemberPolicyVersionFields | null | undefined,
  activePolicies: RequiredPolicyMap,
) {
  const acceptedVersions: Record<PolicyKind, number | null> = {
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
    throw new Error(memberResult.error.message);
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
  },
  activePolicies: RequiredPolicyMap,
) {
  if (input.servicePolicyId !== activePolicies.service.id) {
    return "서비스 이용약관이 변경되었습니다. 다시 확인 후 동의해 주세요.";
  }
  if (input.privacyPolicyId !== activePolicies.privacy.id) {
    return "개인정보 처리방침이 변경되었습니다. 다시 확인 후 동의해 주세요.";
  }
  return null;
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
    throw new Error(consentError.message);
  }
  if (updateError) {
    throw new Error(updateError.message);
  }

  return agreedAt;
}
