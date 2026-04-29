import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/ui/Card";
import SectionHeading from "@/components/ui/SectionHeading";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import { formatKoreanDateTimeToMinute } from "@/lib/datetime";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  return formatKoreanDateTimeToMinute(value);
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
        "id,display_name,mm_username,mm_user_id,year,campus,must_change_password,service_policy_version,privacy_policy_version,marketing_policy_version,created_at,updated_at",
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
      .select("id,event_name,status,identifier,path,created_at")
      .eq("actor_type", "member")
      .eq("actor_id", memberId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (memberResult.error || !memberResult.data) {
    notFound();
  }

  const member = memberResult.data;
  const recentLogs = securityLogsResult.data ?? [];

  return (
    <AdminShell title="회원 상세" backHref="/admin/members" backLabel="회원 관리">
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="Member"
          title={member.display_name ?? member.mm_username ?? "회원 상세"}
          description="로그에서 바로 열 수 있는 회원 정보 조회 페이지입니다."
        />

        <StatsRow
          items={[
            { label: "MM 아이디", value: member.mm_username ? `@${member.mm_username}` : "-", hint: member.mm_user_id ?? "외부 식별자 없음" },
            { label: "기수/캠퍼스", value: `${member.year ?? "-"}기 · ${member.campus ?? "-"}`, hint: "가입 프로필 기준" },
            { label: "비밀번호 상태", value: member.must_change_password ? "변경 필요" : "정상", hint: `활성 기기 ${subscriptionsResult.count ?? 0}개` },
            { label: "최근 갱신", value: formatDate(member.updated_at), hint: `가입 ${formatDate(member.created_at)}` },
          ]}
          minItemWidth="13rem"
        />

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)] 2xl:items-start">
          <Card tone="elevated" className="grid gap-4">
            <SectionHeading
              title="최근 인증/보안 활동"
              description="로그 조회에서 연결된 계정의 최근 활동을 빠르게 확인합니다."
            />

            {recentLogs.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface-inset px-4 py-8 text-sm text-muted-foreground">
                최근 인증/보안 로그가 없습니다.
              </div>
            ) : (
              <div className="grid gap-3">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-border bg-surface-inset px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-foreground">{log.event_name}</p>
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                      <p>상태: {log.status}</p>
                      <p>입력값: {log.identifier ?? "-"}</p>
                      <p className="break-all">경로: {log.path ?? "-"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card tone="elevated" className="grid gap-4 2xl:sticky 2xl:top-24">
            <SectionHeading
              title="계정 요약"
              description="정책 버전과 기본 속성을 확인합니다."
            />
            <div className="grid gap-3 rounded-2xl border border-border bg-surface-inset px-4 py-4 text-sm text-muted-foreground">
              <div className="flex items-center justify-between gap-3">
                <span>회원 ID</span>
                <span className="font-medium text-foreground">{member.id}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>서비스 약관</span>
                <span className="font-medium text-foreground">{member.service_policy_version ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>개인정보 약관</span>
                <span className="font-medium text-foreground">{member.privacy_policy_version ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>마케팅 약관</span>
                <span className="font-medium text-foreground">{member.marketing_policy_version ?? "-"}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AdminShell>
  );
}
