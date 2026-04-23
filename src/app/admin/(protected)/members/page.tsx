import AdminShell from "@/components/admin/AdminShell";
import AdminMemberManualAddPanel from "@/components/admin/AdminMemberManualAddPanel";
import AdminMemberManager from "@/components/admin/AdminMemberManager";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import InlineMessage from "@/components/ui/InlineMessage";
import FormMessage from "@/components/ui/FormMessage";
import ShellHeader from "@/components/ui/ShellHeader";
import SubmitButton from "@/components/ui/SubmitButton";
import SectionHeading from "@/components/ui/SectionHeading";
import {
  backfillMemberProfiles,
  deleteMember,
  manualAddMembers,
  updateMember,
} from "@/app/admin/(protected)/actions";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import {
  getActiveRequiredPolicies,
  getPolicyDocumentByKind,
} from "@/lib/policy-documents";
import { getPushPreferencesOrDefault } from "@/lib/push";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const adminMembersErrorMessages: Record<string, string> = {
  ...adminActionErrorMessages,
};

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    backfill?: string;
    checked?: string;
    updated?: string;
    skipped?: string;
    failures?: string;
    error?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const memberError = params.error ? adminMembersErrorMessages[params.error] : null;
  const supabase = getSupabaseAdminClient();
  const [activePolicies, activeMarketingPolicy, memberQuery] = await Promise.all([
    getActiveRequiredPolicies(),
    getPolicyDocumentByKind("marketing").catch(() => null),
    supabase
      .from("members")
      .select(
        "id,mm_user_id,mm_username,display_name,year,campus,must_change_password,service_policy_version,privacy_policy_version,marketing_policy_version,avatar_content_type,avatar_base64,created_at,updated_at",
      )
      .order("created_at", { ascending: false }),
  ]);
  const { data: members, error: membersError } = memberQuery;

  const safeMembers = members ?? [];
  const memberIds = safeMembers.map((member) => member.id);
  let preferenceRows: Array<{
    member_id: string;
    enabled: boolean;
    announcement_enabled: boolean;
    new_partner_enabled: boolean;
    expiring_partner_enabled: boolean;
    review_enabled: boolean;
    mm_enabled: boolean;
    marketing_enabled: boolean;
  }> = [];
  let subscriptionRows: Array<{ member_id: string }> = [];

  if (memberIds.length) {
    const [preferenceResult, subscriptionResult] = await Promise.all([
      supabase
        .from("push_preferences")
        .select(
          "member_id,enabled,announcement_enabled,new_partner_enabled,expiring_partner_enabled,review_enabled,mm_enabled,marketing_enabled",
        )
        .in("member_id", memberIds),
      supabase
        .from("push_subscriptions")
        .select("member_id")
        .eq("is_active", true)
        .in("member_id", memberIds),
    ]);

    preferenceRows = (preferenceResult.data ?? []) as typeof preferenceRows;
    subscriptionRows = (subscriptionResult.data ?? []) as typeof subscriptionRows;
  }
  let consentRows: Array<{
    member_id: string;
    kind: "service" | "privacy" | "marketing";
    version: number;
    agreed_at: string;
    policy_documents:
      | { title?: string | null; effective_at?: string | null }
      | Array<{ title?: string | null; effective_at?: string | null }>
      | null;
  }> = [];

  if (memberIds.length) {
    const { data } = await supabase
      .from("member_policy_consents")
      .select(
        "member_id,kind,version,agreed_at,policy_documents(title,effective_at)",
      )
      .in("member_id", memberIds)
      .order("agreed_at", { ascending: false });

    consentRows = (data ?? []) as typeof consentRows;
  }

  let consentActivityRows: Array<{
    actor_id: string;
    properties: {
      serviceVersion?: number | null;
      privacyVersion?: number | null;
      marketingVersion?: number | null;
      marketingChecked?: boolean | null;
    } | null;
    created_at: string;
  }> = [];

  if (memberIds.length) {
    const { data } = await supabase
      .from("auth_security_logs")
      .select("actor_id,properties,created_at")
      .eq("event_name", "member_policy_consent")
      .eq("status", "success")
      .eq("actor_type", "member")
      .in("actor_id", memberIds)
      .order("created_at", { ascending: false });

    consentActivityRows = (data ?? []) as typeof consentActivityRows;
  }

  const consentHistoryByMemberId = new Map<
    string,
    Array<{
      kind: "service" | "privacy" | "marketing";
      version: number;
      agreed_at: string;
      title?: string | null;
      effective_at?: string | null;
    }>
  >();

  for (const row of consentRows) {
    const current = consentHistoryByMemberId.get(row.member_id) ?? [];
    const document = Array.isArray(row.policy_documents)
      ? row.policy_documents[0]
      : row.policy_documents;
    current.push({
      kind: row.kind,
      version: row.version,
      agreed_at: row.agreed_at,
      title: document?.title ?? null,
      effective_at: document?.effective_at ?? null,
    });
    consentHistoryByMemberId.set(row.member_id, current);
  }

  const consentActivityByMemberId = new Map<
    string,
    Array<{
      kind: "service" | "privacy" | "marketing";
      agreed: boolean;
      at: string;
      version?: number | null;
      title?: string | null;
      effective_at?: string | null;
    }>
  >();

  for (const row of consentActivityRows) {
    const current = consentActivityByMemberId.get(row.actor_id) ?? [];
    const properties = row.properties ?? {};

    if (typeof properties.serviceVersion === "number") {
      current.push({
        kind: "service",
        agreed: true,
        at: row.created_at,
        version: properties.serviceVersion,
      });
    }

    if (typeof properties.privacyVersion === "number") {
      current.push({
        kind: "privacy",
        agreed: true,
        at: row.created_at,
        version: properties.privacyVersion,
      });
    }

    if (
      typeof properties.marketingChecked === "boolean" ||
      typeof properties.marketingVersion === "number"
    ) {
      current.push({
        kind: "marketing",
        agreed: Boolean(properties.marketingChecked),
        at: row.created_at,
        version: properties.marketingVersion ?? null,
      });
    }

    consentActivityByMemberId.set(row.actor_id, current);
  }

  const preferenceMap = new Map(
    (preferenceRows ?? []).map((row) => [
      row.member_id,
      getPushPreferencesOrDefault({
        enabled: row.enabled,
        announcementEnabled: row.announcement_enabled,
        newPartnerEnabled: row.new_partner_enabled,
        expiringPartnerEnabled: row.expiring_partner_enabled,
        reviewEnabled: row.review_enabled,
        mmEnabled: row.mm_enabled,
        marketingEnabled: row.marketing_enabled,
      }),
    ]),
  );
  const activePolicyVersions = {
    service: activePolicies.service.version,
    privacy: activePolicies.privacy.version,
    marketing: activeMarketingPolicy?.version ?? null,
  };
  const activeDeviceCountByMemberId = new Map<string, number>();
  for (const row of subscriptionRows ?? []) {
    activeDeviceCountByMemberId.set(
      row.member_id,
      (activeDeviceCountByMemberId.get(row.member_id) ?? 0) + 1,
    );
  }

  const enrichedMembers = safeMembers.map((member) => ({
    ...member,
    notification_preferences: {
      ...getPushPreferencesOrDefault(preferenceMap.get(member.id)),
      marketingEnabled: Boolean(
        activeMarketingPolicy &&
          member.marketing_policy_version === activeMarketingPolicy.version,
      ),
      activeDeviceCount: activeDeviceCountByMemberId.get(member.id) ?? 0,
    },
    consent_history: consentHistoryByMemberId.get(member.id) ?? [],
    consent_activity: consentActivityByMemberId.get(member.id) ?? [],
  }));

  return (
    <AdminShell
      title="회원 관리"
      backHref="/admin"
      backLabel="관리 홈"
    >
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Members"
          title="회원 계정 관리"
          description="회원 표시 정보, 비밀번호 변경 필요 여부, 수동 추가와 백필 작업을 관리합니다."
        />
        {membersError ? (
          <FormMessage variant="error">
            회원 목록을 불러오지 못했습니다. {membersError.message}
          </FormMessage>
        ) : null}
        {memberError ? (
          <FormMessage variant="error">{memberError}</FormMessage>
        ) : null}
        <Card tone="elevated">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeading
              title="회원 관리"
              description="회원의 표시 정보와 비밀번호 변경 강제 여부를 관리할 수 있습니다."
            />
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" href="/admin/members/mock">
                Mock 미리보기
              </Button>
              <form action={backfillMemberProfiles}>
                <SubmitButton pendingText="백필 중">
                  지금 백필 실행
                </SubmitButton>
              </form>
            </div>
          </div>

          {params.backfill ? (
            <InlineMessage
              className="mt-6"
              tone={
                params.backfill === "partial"
                  ? "warning"
                  : params.backfill === "error"
                    ? "danger"
                    : "success"
              }
              title={
                params.backfill === "partial"
                  ? "백필이 일부만 완료되었습니다."
                  : params.backfill === "error"
                    ? "백필 중 오류가 발생했습니다."
                    : "백필이 완료되었습니다."
              }
              description={`${params.checked ? `대상 ${params.checked}명 · ` : ""}${params.updated ? `변경 ${params.updated}명 · ` : ""}${params.skipped ? `변경 없음 ${params.skipped}명 · ` : ""}${params.failures ? `실패 ${params.failures}명` : ""}`}
            />
          ) : null}
        </Card>

        <Card tone="elevated">
          <SectionHeading
            title="유저 수동 추가"
            description="MM 아이디를 입력하면 해당 기수에서 찾아 임시 비밀번호를 전송하고, 비밀번호 변경이 필요하도록 저장합니다. 운영진은 15기에서 먼저 찾고 없으면 14기에서 찾습니다."
          />
          <div className="mt-6">
            <AdminMemberManualAddPanel action={manualAddMembers} />
          </div>
        </Card>

        {safeMembers.length === 0 ? (
          <Card tone="elevated">
            <EmptyState
              title="등록된 회원이 없습니다."
              description="회원가입이 완료된 교육생이 생기면 이곳에서 관리할 수 있습니다."
            />
          </Card>
        ) : (
          <Card tone="elevated">
            <AdminMemberManager
              members={enrichedMembers}
              activePolicyVersions={activePolicyVersions}
              updateMember={updateMember}
              deleteMember={deleteMember}
            />
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
