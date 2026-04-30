import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import AdminMemberSecurityLogExplorer, {
  type AdminMemberSecurityLog,
} from "@/components/admin/member-detail/AdminMemberSecurityLogExplorer";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { formatSsafyMemberLifecycleLabel, getCurrentSsafyYear } from "@/lib/ssafy-year";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return formatKoreanDateTimeToMinute(value);
}

function getPolicyBadgeClass(value?: number | null) {
  return value
    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200"
    : "border-border bg-surface-muted text-muted-foreground";
}

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  const supabase = getSupabaseAdminClient();

  const [memberResult, subscriptionsResult, securityLogsResult] = await Promise.all([
    supabase
      .from("members")
      .select(
        "id,display_name,mm_username,mm_user_id,year,campus,must_change_password,service_policy_version,privacy_policy_version,marketing_policy_version,avatar_content_type,created_at,updated_at",
      )
      .eq("id", memberId)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("member_id", memberId)
      .eq("is_active", true),
    supabase
      .from("auth_security_logs")
      .select("id,event_name,status,identifier,path,ip_address,properties,created_at")
      .eq("actor_type", "member")
      .eq("actor_id", memberId)
      .order("created_at", { ascending: false })
      .range(0, 4999),
  ]);

  if (memberResult.error || !memberResult.data) {
    notFound();
  }

  const member = memberResult.data;
  const securityLogs: AdminMemberSecurityLog[] = (securityLogsResult.data ?? []).map((log) => ({
    id: log.id,
    eventName: log.event_name,
    status: log.status,
    identifier: log.identifier,
    path: log.path,
    ipAddress: log.ip_address,
    properties:
      log.properties && typeof log.properties === "object" && !Array.isArray(log.properties)
        ? (log.properties as Record<string, unknown>)
        : null,
    createdAt: log.created_at,
  }));
  const profile = parseSsafyProfile(member.display_name ?? member.mm_username);
  const displayName = profile.displayName ?? member.display_name ?? member.mm_username ?? "회원 상세";
  const year = member.year ?? getCurrentSsafyYear();
  const yearLabel = formatSsafyMemberLifecycleLabel(year);
  const campus = member.campus ?? profile.campus ?? "-";
  const avatarLabel = (displayName || member.mm_username || "?").trim().charAt(0).toUpperCase();
  const hasAvatar = Boolean(member.avatar_content_type);
  const avatarUrl = `/api/admin/members/${member.id}/avatar${member.updated_at ? `?v=${encodeURIComponent(member.updated_at)}` : ""}`;

  return (
    <AdminShell title="회원 상세" backHref="/admin/members" backLabel="회원 관리">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Member"
          title={displayName}
          description="회원 프로필, 약관 상태, 활성 기기, 인증/보안 활동을 한 화면에서 확인합니다."
        />

        <StatsRow
          items={[
            { label: "MM 아이디", value: member.mm_username ? `@${member.mm_username}` : "-", hint: member.mm_user_id ?? "외부 식별자 없음" },
            { label: "기수/캠퍼스", value: `${yearLabel} · ${campus}`, hint: "가입 프로필 기준" },
            { label: "비밀번호 상태", value: member.must_change_password ? "변경 필요" : "정상", hint: `활성 기기 ${subscriptionsResult.count ?? 0}개` },
            { label: "최근 갱신", value: formatDate(member.updated_at), hint: `가입 ${formatDate(member.created_at)}` },
          ]}
          minItemWidth="13rem"
        />

        <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
          <div className="grid gap-6 xl:sticky xl:top-24">
            <Card tone="elevated" className="grid gap-5">
              <div className="overflow-hidden rounded-[1.5rem] border border-border bg-surface-inset">
                <div className="aspect-square w-full">
                  {hasAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={`${displayName} 프로필 사진`}
                      loading="eager"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface-muted text-6xl font-semibold text-foreground">
                      {avatarLabel || "?"}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={member.must_change_password ? "warning" : "success"}>
                    {member.must_change_password ? "비밀번호 변경 필요" : "비밀번호 정상"}
                  </Badge>
                  <Badge variant="neutral">{yearLabel}</Badge>
                </div>
                <h2 className="break-words text-2xl font-semibold tracking-[-0.03em] text-foreground">
                  {displayName}
                </h2>
                <p className="break-all text-sm text-muted-foreground">
                  @{member.mm_username ?? "mm_username 없음"}
                </p>
              </div>

              <div className="grid gap-3 rounded-2xl border border-border bg-surface-inset px-4 py-4 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-3">
                  <span>캠퍼스</span>
                  <span className="font-medium text-foreground">{campus}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>MM User ID</span>
                  <span className="max-w-[13rem] break-all text-right font-medium text-foreground">
                    {member.mm_user_id ?? "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>활성 푸시 기기</span>
                  <span className="font-medium text-foreground">{subscriptionsResult.count ?? 0}개</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>보안 로그</span>
                  <span className="font-medium text-foreground">{securityLogs.length.toLocaleString()}건</span>
                </div>
              </div>
            </Card>

            <Card tone="default" className="grid gap-4">
              <SectionHeading
                title="계정/약관 요약"
                description="정책 버전과 기본 식별자를 확인합니다."
              />
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="grid gap-1 rounded-2xl border border-border bg-surface-inset px-4 py-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em]">회원 ID</span>
                  <span className="break-all font-medium text-foreground">{member.id}</span>
                </div>
                <div className="grid gap-2">
                  <Badge className={getPolicyBadgeClass(member.service_policy_version)}>
                    서비스 약관 v{member.service_policy_version ?? "-"}
                  </Badge>
                  <Badge className={getPolicyBadgeClass(member.privacy_policy_version)}>
                    개인정보 약관 v{member.privacy_policy_version ?? "-"}
                  </Badge>
                  <Badge className={getPolicyBadgeClass(member.marketing_policy_version)}>
                    마케팅 약관 v{member.marketing_policy_version ?? "-"}
                  </Badge>
                </div>
              </div>
            </Card>
          </div>

          <AdminMemberSecurityLogExplorer logs={securityLogs} />
        </div>
      </div>
    </AdminShell>
  );
}
