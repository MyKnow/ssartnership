import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import ShowcaseEventSettingsForm from "@/components/admin/ShowcaseEventSettingsForm";
import ShowcaseProjectReviewForm from "@/components/admin/ShowcaseProjectReviewForm";
import Button from "@/components/ui/Button";
import { requireAdminPermission } from "@/lib/admin-access";
import { canAdmin } from "@/lib/admin-permissions";
import { getShowcasePhase, projectShowcaseRepository } from "@/lib/project-showcase";
import { SHOWCASE_ADMIN_PHASE_LABELS, SHOWCASE_ADMIN_STATUS_LABELS, SHOWCASE_TYPE_LABELS } from "@/lib/project-showcase/labels";
import { SHOWCASE_PROJECT_STATUSES, type ShowcaseProjectStatus } from "@/lib/project-showcase/types";

export const dynamic = "force-dynamic";

const ADMIN_PATH = "/admin/events/project-showcase";

export default async function AdminProjectShowcasePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminPermission("events", "read", { path: ADMIN_PATH });
  const params = (await searchParams) ?? {};
  const rawStatus = typeof params.status === "string" ? params.status : "pending";
  const status: ShowcaseProjectStatus = SHOWCASE_PROJECT_STATUSES.find((value) => value === rawStatus) ?? "pending";
  const [event, metrics, projects] = await Promise.all([
    projectShowcaseRepository.getEvent(),
    projectShowcaseRepository.getAdminMetrics(),
    projectShowcaseRepository.listAdminProjects(status),
  ]);
  const canUpdate = canAdmin(admin.account.permissions, "events", "update");
  const phase = getShowcasePhase(event);

  return (
    <AdminShell title="프로젝트 쇼케이스" backHref="/admin/events" backLabel="이벤트 관리">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="이벤트 운영"
          title="내 프로젝트를 소개합니다!"
          description="모집·체험·발표 일정과 경품 수량을 설정하고 출품작을 검수합니다. 동일한 프로젝트가 중복 등록됐다면 이미 등록된 프로젝트라는 사유로 반려해 주세요."
        />
        <div className="flex flex-wrap gap-3">
          <Button href={`${ADMIN_PATH}/draw`}>추첨·발표</Button>
          <Button href={`${ADMIN_PATH}/feedback`} variant="secondary">피드백 관리</Button>
          <Button href={`${ADMIN_PATH}/logs`} variant="secondary">로그·집계</Button>
          <Button href="/events/project-showcase" variant="secondary">공개 페이지 보기</Button>
        </div>

        {event ? (
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="showcase-settings-heading">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="showcase-settings-heading" className="text-lg font-bold text-foreground">일정과 경품 수량</h2>
                <p className="mt-1 text-sm text-muted-foreground">현재 단계: {SHOWCASE_ADMIN_PHASE_LABELS[phase]}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${event.isActive ? "bg-success/10 text-success" : "bg-surface-muted text-muted-foreground"}`}>
                {event.isActive ? "활성" : "비활성"}
              </span>
            </div>
            {canUpdate ? <ShowcaseEventSettingsForm event={event} /> : <p className="text-sm text-muted-foreground">일정을 바꾸려면 이벤트 수정 권한이 필요해요.</p>}
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">쇼케이스 이벤트 설정을 찾을 수 없어요. 마이그레이션 적용 상태를 확인해 주세요.</section>
        )}

        <section className="grid gap-4" aria-labelledby="showcase-projects-heading">
          <div>
            <h2 id="showcase-projects-heading" className="text-lg font-bold text-foreground">출품작</h2>
            <p className="mt-1 text-sm text-muted-foreground">승인한 출품만 체험 기간에 공개되고 출품 경품 추첨 대상이 돼요.</p>
          </div>
          <nav aria-label="출품 상태" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {SHOWCASE_PROJECT_STATUSES.map((value) => (
              <Link
                key={value}
                href={`${ADMIN_PATH}?status=${value}`}
                aria-current={value === status ? "page" : undefined}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ${value === status ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}
              >
                {SHOWCASE_ADMIN_STATUS_LABELS[value]} <span className="tabular-nums">{metrics?.statusCounts[value] ?? 0}</span>
              </Link>
            ))}
          </nav>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
              {SHOWCASE_ADMIN_STATUS_LABELS[status]} 상태의 출품작이 없어요.
            </div>
          ) : projects.map((project) => (
            <article key={project.id} className="grid gap-5 rounded-2xl border border-border bg-surface p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{SHOWCASE_TYPE_LABELS[project.projectType]}</span>
                <h3 className="break-words text-lg font-bold text-foreground">{project.title}</h3>
                {project.teamName ? <span className="text-sm text-muted-foreground">{project.teamName}</span> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-[170px_minmax(0,1fr)]">
                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={project.imageUrl} alt={`${project.title} 대표 이미지`} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{project.summary}</p>
                  <p className="mt-2 line-clamp-6 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{project.description}</p>
                  <a href={project.serviceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block break-all text-sm font-semibold text-primary underline">체험 주소 확인</a>
                  <p className="mt-3 text-xs text-muted-foreground">
                    대표자 {project.ownerDisplayName} · 조회 {project.viewCount} · 피드백 {project.validExperienceCount} · 관심 {project.interestCount}
                  </p>
                </div>
              </div>
              {canUpdate && project.status !== "withdrawn" ? (
                <ShowcaseProjectReviewForm projectId={project.id} currentStatus={project.status} currentNote={project.reviewNote} />
              ) : project.reviewNote ? (
                <p className="text-sm text-muted-foreground">검수 사유: {project.reviewNote}</p>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </AdminShell>
  );
}
