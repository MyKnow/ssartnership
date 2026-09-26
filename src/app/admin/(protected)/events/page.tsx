import Button from "@/components/ui/Button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
import { getShowcasePhase, projectShowcaseRepository } from "@/lib/project-showcase";
import { SHOWCASE_ADMIN_PHASE_LABELS } from "@/lib/project-showcase/labels";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  await requireAdminPermission("events", "read", { path: "/admin/events" });
  const [event, metrics] = await Promise.all([
    projectShowcaseRepository.getEvent(),
    projectShowcaseRepository.getAdminMetrics(),
  ]);
  const projectCount = metrics
    ? Object.entries(metrics.statusCounts).reduce((total, [status, count]) => status === "withdrawn" ? total : total + count, 0)
    : 0;
  const phase = getShowcasePhase(event);

  return (
    <AdminShell title="이벤트 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="이벤트 운영"
          title="이벤트 관리"
          description="이벤트별 운영 화면과 참여 현황, 로그·집계를 확인합니다."
        />

        <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7" aria-labelledby="showcase-event-heading">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">SSAFY PROJECT SHOWCASE</p>
              <h2 id="showcase-event-heading" className="mt-2 text-2xl font-bold text-foreground">
                {event?.title ?? "내 프로젝트를 소개합니다!"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{event ? SHOWCASE_ADMIN_PHASE_LABELS[phase] : "이벤트 설정을 찾을 수 없습니다."}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${event?.isActive ? "bg-success/10 text-success" : "bg-surface-muted text-muted-foreground"}`}>
              {event?.isActive ? "활성" : "비활성"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["등록 프로젝트", projectCount],
              ["고유 상세 조회", metrics?.totalUniqueViews ?? 0],
              ["체험 시작", metrics?.totalExperienceStarts ?? 0],
              ["피드백", metrics?.totalValidExperiences ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-surface-muted/70 p-4">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{Number(value).toLocaleString("ko-KR")}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/admin/events/project-showcase">쇼케이스 운영</Button>
            <Button href="/admin/events/project-showcase/logs" variant="secondary">로그·집계 확인</Button>
            <Button href="/events/project-showcase" variant="secondary">공개 페이지 보기</Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-bold text-foreground">기존 이벤트 게시 관리</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">프로모션으로 등록한 이벤트의 공개 상태, 기간, 대상은 기존 이벤트 관리에서 운영합니다.</p>
          <div className="mt-4"><Button href="/admin/event" variant="secondary">기존 이벤트 목록</Button></div>
        </section>
      </div>
    </AdminShell>
  );
}
