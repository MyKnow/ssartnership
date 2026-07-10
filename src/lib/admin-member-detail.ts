import { getPushPreferencesOrDefault } from "@/lib/push/preferences";

export type AdminMemberPolicyKind = "service" | "privacy" | "marketing";

export type AdminMemberPushPreferenceRow = {
  enabled: boolean;
  announcement_enabled: boolean;
  new_partner_enabled: boolean;
  expiring_partner_enabled: boolean;
  review_enabled: boolean;
  mm_enabled: boolean;
  marketing_enabled: boolean;
};

export type AdminMemberNotificationPreferences = ReturnType<
  typeof getPushPreferencesOrDefault
> & {
  activeDeviceCount: number;
};

export type AdminMemberPolicySnapshot = {
  servicePolicyVersion?: number | null;
  servicePolicyConsentedAt?: string | null;
  privacyPolicyVersion?: number | null;
  privacyPolicyConsentedAt?: string | null;
  marketingPolicyVersion?: number | null;
  marketingPolicyConsentedAt?: string | null;
};

export type AdminMemberActivePolicyVersions = Record<
  AdminMemberPolicyKind,
  number | null
>;

type PolicyDocumentRelation =
  | { title?: string | null; effective_at?: string | null }
  | Array<{ title?: string | null; effective_at?: string | null }>
  | null;

export type AdminMemberConsentHistoryRow = {
  kind: AdminMemberPolicyKind;
  version: number;
  agreed_at: string;
  policy_documents: PolicyDocumentRelation;
};

export type AdminMemberConsentActivityRow = {
  properties: Record<string, unknown> | null;
  created_at: string;
};

export type AdminMemberPolicyEvent = {
  kind: AdminMemberPolicyKind;
  agreed: boolean;
  at: string;
  version: number | null;
  title: string | null;
  effectiveAt: string | null;
};

export type AdminMemberPolicyState = {
  kind: AdminMemberPolicyKind;
  label: string;
  status: "current" | "outdated" | "agreed" | "revoked" | "notAgreed";
  statusLabel: string;
  version: number | null;
  eventAt: string | null;
  eventLabel: "동의 시각" | "철회 시각";
  title: string | null;
  effectiveAt: string | null;
};

const POLICY_META: Array<{
  kind: AdminMemberPolicyKind;
  label: string;
}> = [
  { kind: "service", label: "서비스 이용약관" },
  { kind: "privacy", label: "개인정보 처리방침" },
  { kind: "marketing", label: "마케팅 정보 수신" },
];

function firstDocument(relation: PolicyDocumentRelation) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildActivityEvents(
  rows: readonly AdminMemberConsentActivityRow[],
  documentByKindVersion: ReadonlyMap<string, ReturnType<typeof firstDocument>>,
) {
  const events: AdminMemberPolicyEvent[] = [];

  for (const row of rows) {
    const properties = row.properties ?? {};
    const serviceVersion = readNumber(properties.serviceVersion);
    const privacyVersion = readNumber(properties.privacyVersion);
    const marketingVersion = readNumber(properties.marketingVersion);

    const appendAgreement = (
      kind: AdminMemberPolicyKind,
      version: number | null,
      agreed: boolean,
    ) => {
      const document = version
        ? documentByKindVersion.get(`${kind}:${version}`) ?? null
        : null;
      events.push({
        kind,
        agreed,
        at: row.created_at,
        version,
        title: document?.title ?? null,
        effectiveAt: document?.effective_at ?? null,
      });
    };

    if (serviceVersion !== null) {
      appendAgreement("service", serviceVersion, true);
    }
    if (privacyVersion !== null) {
      appendAgreement("privacy", privacyVersion, true);
    }
    if (
      typeof properties.marketingChecked === "boolean" ||
      marketingVersion !== null
    ) {
      appendAgreement(
        "marketing",
        marketingVersion,
        properties.marketingChecked === true,
      );
    }
  }

  return events;
}

function getSnapshotValue(
  member: AdminMemberPolicySnapshot,
  kind: AdminMemberPolicyKind,
) {
  if (kind === "service") {
    return {
      version: member.servicePolicyVersion ?? null,
      at: member.servicePolicyConsentedAt ?? null,
    };
  }
  if (kind === "privacy") {
    return {
      version: member.privacyPolicyVersion ?? null,
      at: member.privacyPolicyConsentedAt ?? null,
    };
  }
  return {
    version: member.marketingPolicyVersion ?? null,
    at: member.marketingPolicyConsentedAt ?? null,
  };
}

function getPolicyStatus(
  agreed: boolean,
  version: number | null,
  activeVersion: number | null,
) {
  if (!agreed) {
    return version ? ("revoked" as const) : ("notAgreed" as const);
  }
  if (!version) {
    return "notAgreed" as const;
  }
  if (!activeVersion) {
    return "agreed" as const;
  }
  return version === activeVersion
    ? ("current" as const)
    : ("outdated" as const);
}

function getPolicyStatusLabel(status: AdminMemberPolicyState["status"]) {
  switch (status) {
    case "current":
      return "현재 동의";
    case "outdated":
      return "이전 버전 동의";
    case "agreed":
      return "동의";
    case "revoked":
      return "철회됨";
    case "notAgreed":
      return "미동의";
  }
}

export function normalizeAdminMemberNotificationPreferences(
  row: AdminMemberPushPreferenceRow | null | undefined,
  activeDeviceCount: number | null | undefined,
): AdminMemberNotificationPreferences {
  const preferences = getPushPreferencesOrDefault(
    row
      ? {
          enabled: row.enabled,
          announcementEnabled: row.announcement_enabled,
          newPartnerEnabled: row.new_partner_enabled,
          expiringPartnerEnabled: row.expiring_partner_enabled,
          reviewEnabled: row.review_enabled,
          mmEnabled: row.mm_enabled,
          marketingEnabled: row.marketing_enabled,
        }
      : null,
  );

  return {
    ...preferences,
    activeDeviceCount:
      typeof activeDeviceCount === "number" && Number.isFinite(activeDeviceCount)
        ? Math.max(0, Math.trunc(activeDeviceCount))
        : 0,
  };
}

export function buildAdminMemberPolicyOverview({
  member,
  activeVersions,
  consentHistory,
  consentActivity,
}: {
  member: AdminMemberPolicySnapshot;
  activeVersions: AdminMemberActivePolicyVersions;
  consentHistory: readonly AdminMemberConsentHistoryRow[];
  consentActivity: readonly AdminMemberConsentActivityRow[];
}) {
  const documentByKindVersion = new Map<
    string,
    ReturnType<typeof firstDocument>
  >();
  const historyEvents = consentHistory.map((row) => {
    const document = firstDocument(row.policy_documents);
    documentByKindVersion.set(`${row.kind}:${row.version}`, document);
    return {
      kind: row.kind,
      agreed: true,
      at: row.agreed_at,
      version: row.version,
      title: document?.title ?? null,
      effectiveAt: document?.effective_at ?? null,
    } satisfies AdminMemberPolicyEvent;
  });
  const activityEvents = buildActivityEvents(
    consentActivity,
    documentByKindVersion,
  );
  const seen = new Set<string>();
  const timeline = [...historyEvents, ...activityEvents]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .filter((event) => {
      const key = [
        event.kind,
        event.agreed ? "agreed" : "revoked",
        event.version ?? "none",
        event.at,
      ].join(":");
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

  const states = POLICY_META.map(({ kind, label }) => {
    const latest = timeline.find((event) => event.kind === kind) ?? null;
    const snapshot = getSnapshotValue(member, kind);
    const version = latest?.version ?? snapshot.version;
    const agreed = latest ? latest.agreed : snapshot.version !== null;
    const status =
      latest && !latest.agreed
        ? ("revoked" as const)
        : getPolicyStatus(agreed, version, activeVersions[kind]);

    return {
      kind,
      label,
      status,
      statusLabel: getPolicyStatusLabel(status),
      version,
      eventAt: latest?.at ?? snapshot.at,
      eventLabel: status === "revoked" ? "철회 시각" : "동의 시각",
      title: latest?.title ?? null,
      effectiveAt: latest?.effectiveAt ?? null,
    } satisfies AdminMemberPolicyState;
  });

  return { states, timeline };
}
