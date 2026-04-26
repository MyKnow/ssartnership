import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const getSupabaseAdminClient = vi.fn();
const upsertMemberPushPreferences = vi.fn();

vi.mock("../../src/lib/supabase/server", () => ({
  getSupabaseAdminClient,
}));

vi.mock("@/lib/push/preferences", () => ({
  upsertMemberPushPreferences,
}));

type PolicyRow = {
  id: string;
  kind: string;
  version: number;
  title: string;
  summary: string | null;
  content: string;
  is_active: boolean;
  effective_at: string;
  created_at: string | null;
  updated_at: string | null;
};

type MemberRow = {
  id?: string;
  service_policy_version?: number | null;
  service_policy_consented_at?: string | null;
  privacy_policy_version?: number | null;
  privacy_policy_consented_at?: string | null;
  marketing_policy_version?: number | null;
  marketing_policy_consented_at?: string | null;
};

const ENV_KEYS = [
  "NEXT_PUBLIC_DATA_SOURCE",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function createPolicyRow(overrides: Partial<PolicyRow>): PolicyRow {
  return {
    id: "policy-id",
    kind: "service",
    version: 1,
    title: "정책",
    summary: null,
    content: "본문",
    is_active: true,
    effective_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createSupabaseMock({
  policyDocuments = [],
  member = null,
  policyDocumentsError = null,
  memberError = null,
  policyConsentError = null,
  memberUpdateError = null,
}: {
  policyDocuments?: PolicyRow[];
  member?: MemberRow | null;
  policyDocumentsError?: { message: string } | null;
  memberError?: { message: string } | null;
  policyConsentError?: { message: string } | null;
  memberUpdateError?: { message: string } | null;
}) {
  return {
    from(table: string) {
      if (table === "policy_documents") {
        let rows = [...policyDocuments];

        const builder = {
          select() {
            return builder;
          },
          in(field: string, values: unknown[]) {
            if (field === "kind") {
              rows = rows.filter((row) => values.includes(row.kind));
            }
            return builder;
          },
          eq(field: string, value: unknown) {
            if (field === "kind") {
              rows = rows.filter((row) => row.kind === value);
              return builder;
            }
            if (field === "version") {
              rows = rows.filter((row) => row.version === value);
              return builder;
            }
            if (field === "is_active") {
              rows = rows.filter((row) => row.is_active === value);
            }
            return builder;
          },
          order(_field: string, options?: { ascending?: boolean }) {
            rows.sort((a, b) =>
              options?.ascending ? a.version - b.version : b.version - a.version,
            );
            return builder;
          },
          limit(count: number) {
            rows = rows.slice(0, count);
            return builder;
          },
          maybeSingle() {
            return Promise.resolve({
              data: rows[0] ?? null,
              error: policyDocumentsError,
            });
          },
          then(resolve: (value: { data: PolicyRow[]; error: { message: string } | null }) => unknown) {
            return Promise.resolve({
              data: rows,
              error: policyDocumentsError,
            }).then(resolve);
          },
        };

        return builder;
      }

      if (table === "members") {
        let pendingUpdate: Record<string, unknown> | null = null;

        const builder = {
          select() {
            return builder;
          },
          eq() {
            if (pendingUpdate) {
              return Promise.resolve({ error: memberUpdateError });
            }
            return builder;
          },
          maybeSingle() {
            return Promise.resolve({
              data: member,
              error: memberError,
            });
          },
          update(payload: Record<string, unknown>) {
            pendingUpdate = payload;
            return builder;
          },
        };

        return builder;
      }

      if (table === "member_policy_consents") {
        return {
          upsert() {
            return Promise.resolve({ error: policyConsentError });
          },
        };
      }

      throw new Error(`Unsupported table: ${table}`);
    },
  };
}

async function loadPolicyDocumentsModule({
  useMockData,
}: {
  useMockData: boolean;
}) {
  vi.resetModules();
  vi.clearAllMocks();

  process.env.NEXT_PUBLIC_DATA_SOURCE = useMockData ? "mock" : "supabase";
  process.env.SUPABASE_URL = useMockData ? "" : "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = useMockData ? "" : "service-role-key";

  return import("../../src/lib/policy-documents");
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-26T07:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

describe("policy documents", () => {
  test("handles kind helpers, labels, descriptions, and hrefs", async () => {
    const policies = await loadPolicyDocumentsModule({ useMockData: true });

    expect(policies.isPolicyKind("service")).toBe(true);
    expect(policies.isPolicyKind("unknown")).toBe(false);
    expect(policies.isRequiredPolicyKind("privacy")).toBe(true);
    expect(policies.isRequiredPolicyKind("marketing")).toBe(false);
    expect(policies.getPolicyKindLabel("service")).toBe("서비스 이용약관");
    expect(policies.getPolicyKindLabel("privacy")).toBe(
      "개인정보 수집·이용 및 처리방침",
    );
    expect(policies.getPolicyKindLabel("marketing")).toBe(
      "마케팅 정보 수신 동의",
    );
    expect(policies.getPolicyDescription("service")).toContain("회원가입");
    expect(policies.getPolicyDescription("privacy")).toContain("개인정보");
    expect(policies.getPolicyDescription("marketing")).toContain("이벤트");
    expect(policies.getPolicyHref("service")).toBe("/legal/service");
    expect(policies.getPolicyHref("privacy", 2, "/signup")).toBe(
      "/legal/privacy?version=2&returnTo=%2Fsignup",
    );
  });

  test("returns mock active policies and documents in mock mode", async () => {
    const policies = await loadPolicyDocumentsModule({ useMockData: true });

    await expect(policies.getActiveRequiredPolicies()).resolves.toEqual(
      expect.objectContaining({
        service: expect.objectContaining({ kind: "service", is_active: true }),
        privacy: expect.objectContaining({ kind: "privacy", is_active: true }),
      }),
    );
    await expect(policies.getPolicyDocumentByKind("marketing")).resolves.toEqual(
      expect.objectContaining({ kind: "marketing", version: 1 }),
    );
    await expect(policies.getPolicyDocumentByKind("service", 999)).resolves.toBeNull();
    await expect(policies.getPolicyDocumentsByKind("service")).resolves.toEqual([
      expect.objectContaining({ kind: "service", version: 1 }),
    ]);
  });

  test("returns latest required policies and document history in db mode", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        policyDocuments: [
          createPolicyRow({
            id: "service-v1",
            kind: "service",
            version: 1,
            is_active: false,
          }),
          createPolicyRow({
            id: "service-v2",
            kind: "service",
            version: 2,
            is_active: true,
          }),
          createPolicyRow({
            id: "privacy-v1",
            kind: "privacy",
            version: 1,
            is_active: true,
          }),
          createPolicyRow({
            id: "marketing-v3",
            kind: "marketing",
            version: 3,
            is_active: true,
          }),
          createPolicyRow({
            id: "ignored-v1",
            kind: "invalid-kind",
            version: 1,
            is_active: true,
          }),
        ],
      }),
    );

    const policies = await loadPolicyDocumentsModule({ useMockData: false });

    await expect(policies.getActiveRequiredPolicies()).resolves.toEqual({
      service: expect.objectContaining({ id: "service-v2", version: 2 }),
      privacy: expect.objectContaining({ id: "privacy-v1", version: 1 }),
    });
    await expect(policies.getPolicyDocumentByKind("marketing")).resolves.toEqual(
      expect.objectContaining({ id: "marketing-v3", version: 3 }),
    );
    await expect(policies.getPolicyDocumentsByKind("service")).resolves.toEqual([
      expect.objectContaining({ id: "service-v2", version: 2 }),
      expect.objectContaining({ id: "service-v1", version: 1 }),
    ]);
  });

  test("surfaces db and not-found errors while loading policies", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        policyDocuments: [createPolicyRow({ id: "service-v2", kind: "service", version: 2 })],
      }),
    );

    let policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(policies.getActiveRequiredPolicies()).rejects.toMatchObject({
      code: "not_found",
    });

    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        policyDocumentsError: { message: "정책 조회 실패" },
      }),
    );
    policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(policies.getPolicyDocumentByKind("service")).rejects.toMatchObject({
      code: "db_error",
      message: "정책 조회 실패",
    });
    await expect(policies.getPolicyDocumentsByKind("service")).rejects.toMatchObject({
      code: "db_error",
      message: "정책 조회 실패",
    });
  });

  test("builds member review bundle and required status", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        policyDocuments: [
          createPolicyRow({
            id: "service-v2",
            kind: "service",
            version: 2,
            is_active: true,
          }),
          createPolicyRow({
            id: "privacy-v3",
            kind: "privacy",
            version: 3,
            is_active: true,
          }),
          createPolicyRow({
            id: "marketing-v5",
            kind: "marketing",
            version: 5,
            is_active: true,
          }),
        ],
        member: {
          service_policy_version: 1,
          privacy_policy_version: 3,
          marketing_policy_version: 4,
        },
      }),
    );

    const policies = await loadPolicyDocumentsModule({ useMockData: false });
    const bundle = await policies.getMemberPolicyReviewBundle("member-1");
    const status = policies.evaluateRequiredPolicyStatus(
      {
        service_policy_version: 1,
        privacy_policy_version: 3,
      },
      bundle.requiredPolicies,
    );

    expect(bundle.requiredPolicies.service.version).toBe(2);
    expect(bundle.reviewPolicies).toEqual([
      {
        policy: expect.objectContaining({ id: "service-v2", version: 2 }),
        required: true,
      },
      {
        policy: expect.objectContaining({ id: "marketing-v5", version: 5 }),
        required: false,
      },
    ]);
    expect(status).toEqual({
      requiresConsent: true,
      outdatedKinds: ["service"],
      acceptedVersions: {
        service: 1,
        privacy: 3,
      },
    });
  });

  test("handles member policy review lookup errors and required status lookups", async () => {
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        policyDocuments: [
          createPolicyRow({
            id: "service-v2",
            kind: "service",
            version: 2,
            is_active: true,
          }),
          createPolicyRow({
            id: "privacy-v3",
            kind: "privacy",
            version: 3,
            is_active: true,
          }),
        ],
        memberError: { message: "회원 조회 실패" },
      }),
    );

    let policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(policies.getMemberPolicyReviewBundle("member-1")).rejects.toMatchObject({
      code: "db_error",
      message: "회원 조회 실패",
    });
    await expect(
      policies.getMemberRequiredPolicyStatus("member-1"),
    ).rejects.toMatchObject({
      code: "db_error",
      message: "회원 조회 실패",
    });

    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        policyDocuments: [
          createPolicyRow({
            id: "service-v2",
            kind: "service",
            version: 2,
            is_active: true,
          }),
          createPolicyRow({
            id: "privacy-v3",
            kind: "privacy",
            version: 3,
            is_active: true,
          }),
        ],
        member: null,
      }),
    );
    policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(policies.getMemberPolicyReviewBundle("member-1")).rejects.toMatchObject({
      code: "not_found",
    });

    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        policyDocuments: [
          createPolicyRow({
            id: "service-v2",
            kind: "service",
            version: 2,
            is_active: true,
          }),
          createPolicyRow({
            id: "privacy-v3",
            kind: "privacy",
            version: 3,
            is_active: true,
          }),
        ],
        member: {
          service_policy_version: 2,
          privacy_policy_version: 3,
        },
      }),
    );
    policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(policies.getMemberRequiredPolicyStatus("member-1")).resolves.toEqual(
      expect.objectContaining({
        requiresConsent: false,
        outdatedKinds: [],
      }),
    );
  });

  test("validates selected policy ids conservatively", async () => {
    const policies = await loadPolicyDocumentsModule({ useMockData: true });
    const activePolicies = {
      service: createPolicyRow({ id: "service-v2", kind: "service", version: 2 }),
      privacy: createPolicyRow({ id: "privacy-v3", kind: "privacy", version: 3 }),
    };
    const marketingPolicy = createPolicyRow({
      id: "marketing-v1",
      kind: "marketing",
      version: 1,
    });

    expect(
      policies.getSelectedPolicyValidationError(
        { servicePolicyId: "wrong", privacyPolicyId: "privacy-v3" },
        activePolicies,
      ),
    ).toContain("서비스 이용약관");
    expect(
      policies.getSelectedPolicyValidationError(
        { servicePolicyId: "service-v2", privacyPolicyId: "wrong" },
        activePolicies,
      ),
    ).toContain("개인정보 처리방침");
    expect(
      policies.getSelectedPolicyValidationError(
        {
          servicePolicyId: "service-v2",
          privacyPolicyId: "privacy-v3",
          marketingPolicyChecked: true,
        },
        activePolicies,
        null,
      ),
    ).toContain("마케팅 정보 수신 동의 문서를 불러오지 못했습니다");
    expect(
      policies.getSelectedPolicyValidationError(
        {
          servicePolicyId: "service-v2",
          privacyPolicyId: "privacy-v3",
          marketingPolicyChecked: true,
          marketingPolicyId: "wrong",
        },
        activePolicies,
        marketingPolicy,
      ),
    ).toContain("마케팅 정보 수신 동의가 변경되었습니다");
    expect(
      policies.getSelectedPolicyValidationError(
        {
          servicePolicyId: "service-v2",
          privacyPolicyId: "privacy-v3",
          marketingPolicyChecked: true,
          marketingPolicyId: "marketing-v1",
        },
        activePolicies,
        marketingPolicy,
      ),
    ).toBeNull();
  });

  test("records marketing policy consent for opt-out and opt-in", async () => {
    upsertMemberPushPreferences.mockResolvedValue({ marketingEnabled: false });
    getSupabaseAdminClient.mockReturnValue(createSupabaseMock({}));

    let policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(
      policies.recordMarketingPolicyConsent({
        memberId: "member-1",
        activePolicy: null,
        agreed: false,
      }),
    ).resolves.toBeNull();
    expect(upsertMemberPushPreferences).toHaveBeenCalledWith("member-1", {
      marketingEnabled: false,
    });

    upsertMemberPushPreferences.mockResolvedValue({ marketingEnabled: true });
    getSupabaseAdminClient.mockReturnValue(createSupabaseMock({}));
    policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(
      policies.recordMarketingPolicyConsent({
        memberId: "member-1",
        activePolicy: createPolicyRow({
          id: "marketing-v2",
          kind: "marketing",
          version: 2,
        }),
        agreed: true,
        ipAddress: "127.0.0.1",
        userAgent: "Vitest",
      }),
    ).resolves.toBe("2026-04-26T07:00:00.000Z");
    expect(upsertMemberPushPreferences).toHaveBeenCalledWith("member-1", {
      marketingEnabled: true,
    });
  });

  test("surfaces marketing policy consent failures", async () => {
    upsertMemberPushPreferences.mockResolvedValue(false);
    getSupabaseAdminClient.mockReturnValue(createSupabaseMock({}));

    let policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(
      policies.recordMarketingPolicyConsent({
        memberId: "member-1",
        activePolicy: null,
        agreed: true,
      }),
    ).rejects.toMatchObject({
      code: "not_found",
    });

    await expect(
      policies.recordMarketingPolicyConsent({
        memberId: "member-1",
        activePolicy: createPolicyRow({
          id: "marketing-v2",
          kind: "marketing",
          version: 2,
        }),
        agreed: false,
      }),
    ).rejects.toMatchObject({
      code: "db_error",
    });

    upsertMemberPushPreferences.mockResolvedValue({ marketingEnabled: true });
    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        policyConsentError: { message: "동의 저장 실패" },
      }),
    );
    policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(
      policies.recordMarketingPolicyConsent({
        memberId: "member-1",
        activePolicy: createPolicyRow({
          id: "marketing-v2",
          kind: "marketing",
          version: 2,
        }),
        agreed: true,
      }),
    ).rejects.toMatchObject({
      code: "db_error",
      message: "동의 저장 실패",
    });

    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        memberUpdateError: { message: "회원 갱신 실패" },
      }),
    );
    policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(
      policies.recordMarketingPolicyConsent({
        memberId: "member-1",
        activePolicy: createPolicyRow({
          id: "marketing-v2",
          kind: "marketing",
          version: 2,
        }),
        agreed: true,
      }),
    ).rejects.toMatchObject({
      code: "db_error",
      message: "회원 갱신 실패",
    });
  });

  test("records required policy consent and surfaces failures", async () => {
    const activePolicies = {
      service: createPolicyRow({
        id: "service-v2",
        kind: "service",
        version: 2,
      }),
      privacy: createPolicyRow({
        id: "privacy-v3",
        kind: "privacy",
        version: 3,
      }),
    };

    getSupabaseAdminClient.mockReturnValue(createSupabaseMock({}));
    let policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(
      policies.recordRequiredPolicyConsent({
        memberId: "member-1",
        activePolicies,
      }),
    ).resolves.toBe("2026-04-26T07:00:00.000Z");

    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        policyConsentError: { message: "필수 동의 저장 실패" },
      }),
    );
    policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(
      policies.recordRequiredPolicyConsent({
        memberId: "member-1",
        activePolicies,
      }),
    ).rejects.toMatchObject({
      code: "db_error",
      message: "필수 동의 저장 실패",
    });

    getSupabaseAdminClient.mockReturnValue(
      createSupabaseMock({
        memberUpdateError: { message: "필수 동의 갱신 실패" },
      }),
    );
    policies = await loadPolicyDocumentsModule({ useMockData: false });
    await expect(
      policies.recordRequiredPolicyConsent({
        memberId: "member-1",
        activePolicies,
      }),
    ).rejects.toMatchObject({
      code: "db_error",
      message: "필수 동의 갱신 실패",
    });
  });
});
