import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
import { projectShowcaseRepository } from "@/lib/project-showcase";
import { SHOWCASE_ADMIN_STATUS_LABELS, SHOWCASE_TYPE_LABELS } from "@/lib/project-showcase/labels";
import {
  SHOWCASE_ADMIN_ACTIVITY_TYPES,
  type ShowcaseAdminActivityCursor,
  type ShowcaseAdminActivityLog,
  type ShowcaseAdminActivityType,
} from "@/lib/project-showcase/repository";
import { SHOWCASE_PROJECT_STATUSES, SHOWCASE_PROJECT_TYPES } from "@/lib/project-showcase/types";

export const dynamic = "force-dynamic";

const LOGS_PATH = "/admin/events/project-showcase/logs";
const PAGE_SIZE = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACTIVITY_LABELS: Record<ShowcaseAdminActivityType, string> = {
  project_submitted: "프로젝트 출품",
  project_withdrawn: "출품 취소",
  project_viewed: "프로젝트 상세 조회",
  experience_started: "체험 시작",
  feedback_submitted: "피드백 제출",
  project_reviewed: "출품 검수",
  event_settings_updated: "이벤트 설정 변경",
  draw_created: "경품 추첨",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseActivityCursor(params: Record<string, string | string[] | undefined>): ShowcaseAdminActivityCursor | null {
  const occurredAt = firstParam(params.beforeAt);
  const id = firstParam(params.beforeId);
  if (!occurredAt || !id || !UUID_PATTERN.test(id)) return null;
  const parsedDate = new Date(occurredAt);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return { occurredAt: parsedDate.toISOString(), id };
}

function activitySummary(item: ShowcaseAdminActivityLog) {
  switch (item.type) {
    case "project_submitted":
      return item.details.projectType ? `${SHOWCASE_TYPE_LABELS[item.details.projectType]} 프로젝트` : "프로젝트 출품";
    case "project_withdrawn":
      return "출품자가 모집 기간 중 취소";
    case "project_viewed":
      return "회원별 최초 1회 기록";
    case "experience_started":
      return "체험 시작 버튼 기록 · 회원별 최초 1회";
    case "feedback_submitted":
      return "체험 1분 경과 후 피드백 · 유효 체험 1건";
    case "project_reviewed":
      return item.details.status ? `검수 결과 · ${SHOWCASE_ADMIN_STATUS_LABELS[item.details.status]}` : "검수 결과 저장";
    case "event_settings_updated":
      return typeof item.details.isActive === "boolean"
        ? item.details.isActive ? "이벤트 활성화 상태로 저장" : "이벤트 비활성화 상태로 저장"
        : "이벤트 운영 설정 저장";
    case "draw_created": {
      const group = item.details.candidateGroup === "submitter" ? "출품" : "체험";
      const candidates = item.details.candidateCount;
      const selected = item.details.selectedCount;
      return candidates !== undefined && selected !== undefined
        ? `${group} 후보 ${candidates.toLocaleString("ko-KR")} 중 ${selected.toLocaleString("ko-KR")} 선정`
        : `${group} 경품 추첨`;
    }
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildNextHref(type: ShowcaseAdminActivityType | null, cursor: ShowcaseAdminActivityCursor) {
  const query = new URLSearchParams({ beforeAt: cursor.occurredAt, beforeId: cursor.id });
  if (type) query.set("type", type);
  return `${LOGS_PATH}?${query.toString()}`;
}

export default async function AdminShowcaseLogsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPermission("events", "read", { path: LOGS_PATH });
  const params = (await searchParams) ?? {};
  const rawType = firstParam(params.type);
  const activityType = SHOWCASE_ADMIN_ACTIVITY_TYPES.find((type) => type === rawType) ?? null;
  const before = parseActivityCursor(params);
  const [event, metrics, activityPage] = await Promise.all([
    projectShowcaseRepository.getEvent(),
    projectShowcaseRepository.getAdminMetrics(),
    projectShowcaseRepository.listAdminActivity({ limit: PAGE_SIZE, before, type: activityType }),
  ]);
  const activeProjectCount = metrics
    ? SHOWCASE_PROJECT_STATUSES.filter((status) => status !== "withdrawn")
      .reduce((total, status) => total + metrics.statusCounts[status], 0)
    : 0;

  return (
    <AdminShell title="이벤트 로그·집계" backHref="/admin/events/project-showcase" backLabel="쇼케이스 운영">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="SSAFY PROJECT SHOWCASE"
          title="이벤트 로그·집계"
          description="출품, 조회·체험·피드백, 검수와 추첨까지 쇼케이스 운영 기록과 집계를 확인합니다. 회원 식별 정보는 표시하지 않아요."
        />

        {!event ? (
          <section className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted-foreground">
            쇼케이스 이벤트 설정을 찾을 수 없어요. 데이터베이스 마이그레이션 적용 상태를 확인해 주세요.
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="이벤트 전체 집계">
              {[
                ["출품 프로젝트", activeProjectCount],
                ["고유 상세 조회", metrics?.totalUniqueViews ?? 0],
                ["체험 시작", metrics?.totalExperienceStarts ?? 0],
                ["피드백 (유효 체험)", metrics?.totalValidExperiences ?? 0],
                ["관심 표시", metrics?.totalInterests ?? 0],
                ["체험 참여 등록", metrics?.registeredExperiencers ?? 0],
                ["완료한 추첨", metrics?.completedDraws ?? 0],
                ["당첨 (유효)", metrics?.activeWinners ?? 0],
              ].map(([label, value]) => (
                <article key={label} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
                  <p className="text-xs font-medium leading-5 text-muted-foreground">{label}</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{Number(value).toLocaleString("ko-KR")}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-5 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2 sm:p-6">
              <div>
                <h2 className="font-bold text-foreground">출품 상태</h2>
                <dl className="mt-3 grid gap-2">
                  {SHOWCASE_PROJECT_STATUSES.map((status) => (
                    <div key={status} className="flex justify-between gap-4 text-sm">
                      <dt className="text-muted-foreground">{SHOWCASE_ADMIN_STATUS_LABELS[status]}</dt>
                      <dd className="font-semibold tabular-nums text-foreground">{metrics?.statusCounts[status] ?? 0}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div>
                <h2 className="font-bold text-foreground">프로젝트 유형 <span className="text-xs font-normal text-muted-foreground">취소 제외</span></h2>
                <dl className="mt-3 grid gap-2">
                  {SHOWCASE_PROJECT_TYPES.map((type) => (
                    <div key={type} className="flex justify-between gap-4 text-sm">
                      <dt className="text-muted-foreground">{SHOWCASE_TYPE_LABELS[type]}</dt>
                      <dd className="font-semibold tabular-nums text-foreground">{metrics?.projectTypeCounts[type] ?? 0}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="project-stats-heading">
              <h2 id="project-stats-heading" className="font-bold text-foreground">승인 프로젝트별 집계</h2>
              {metrics?.projectStats.length ? (
                <div className="mt-4 grid gap-2">
                  {metrics.projectStats.map((project) => (
                    <div key={project.id} className="grid gap-1 rounded-xl bg-surface-muted/60 px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                      <span className="min-w-0 truncate font-medium text-foreground">{project.title}</span>
                      <span className="text-muted-foreground tabular-nums">
                        조회 {project.viewCount} · 체험 {project.experienceCount} · 피드백 {project.validExperienceCount} · 관심 {project.interestCount}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">집계할 승인 프로젝트가 없어요.</p>
              )}
            </section>

            <section className="grid gap-4" aria-labelledby="activity-log-heading">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="activity-log-heading" className="text-xl font-bold text-foreground">전체 활동 로그</h2>
                  <p className="mt-1 text-sm text-muted-foreground">최신순으로 {PAGE_SIZE}건씩 표시해요. 조회와 체험은 회원별 최초 기록만 남아요.</p>
                </div>
                <form action={LOGS_PATH} method="get" className="flex gap-2">
                  <label className="sr-only" htmlFor="showcase-activity-type">활동 유형</label>
                  <select id="showcase-activity-type" name="type" defaultValue={activityType ?? ""} className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm text-foreground">
                    <option value="">모든 활동</option>
                    {SHOWCASE_ADMIN_ACTIVITY_TYPES.map((type) => <option key={type} value={type}>{ACTIVITY_LABELS[type]}</option>)}
                  </select>
                  <button type="submit" className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">적용</button>
                </form>
              </div>

              {activityPage.items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
                  조건에 맞는 이벤트 로그가 없어요.
                </div>
              ) : (
                <div className="grid gap-3">
                  {activityPage.items.map((item) => (
                    <article key={`${item.type}-${item.id}`} className="grid gap-2 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.actorType === "admin" ? "bg-primary/10 text-primary" : "bg-surface-muted text-muted-foreground"}`}>
                            {item.actorType === "admin" ? "운영자" : "회원"}
                          </span>
                          <h3 className="font-bold text-foreground">{ACTIVITY_LABELS[item.type]}</h3>
                        </div>
                        <p className="mt-2 truncate text-sm font-medium text-foreground">{item.projectTitle}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{activitySummary(item)}</p>
                      </div>
                      <time dateTime={item.occurredAt} className="text-xs tabular-nums text-muted-foreground sm:text-right">{formatDate(item.occurredAt)}</time>
                    </article>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                {before ? <Link href={LOGS_PATH} className="text-sm font-semibold text-primary underline">최신 기록으로 돌아가기</Link> : <span />}
                {activityPage.nextCursor ? (
                  <Link href={buildNextHref(activityType, activityPage.nextCursor)} className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-muted">
                    이전 로그 {PAGE_SIZE}건 더 보기
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground">{activityPage.items.length > 0 ? "모든 로그를 확인했어요." : ""}</span>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
