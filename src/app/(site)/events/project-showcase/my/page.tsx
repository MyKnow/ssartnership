import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Button from "@/components/ui/Button";
import { getHeaderSession } from "@/lib/header-session";
import { getShowcasePhase, projectShowcaseRepository } from "@/lib/project-showcase";
import { formatShowcasePeriod } from "@/lib/project-showcase/format";
import { SHOWCASE_OWNER_STATUS_LABELS, SHOWCASE_TYPE_LABELS } from "@/lib/project-showcase/labels";
import { getSignedUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function MyShowcaseParticipationPage() {
  const session = await getSignedUserSession();
  if (!session?.userId) redirect("/auth/login?returnTo=%2Fevents%2Fproject-showcase%2Fmy");
  const [event, project, headerSession] = await Promise.all([
    projectShowcaseRepository.getEvent(),
    projectShowcaseRepository.getActiveOwnerProject(session.userId),
    getHeaderSession(session.userId),
  ]);
  const phase = getShowcasePhase(event);
  const metrics = project
    ? [
      { label: "고유 조회", value: project.viewCount },
      { label: "체험 시작", value: project.experienceCount },
      { label: "피드백", value: project.validExperienceCount },
      { label: "관심 표시", value: project.interestCount },
    ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <Link href="/events/project-showcase" className="text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">← 이벤트로 돌아가기</Link>
        <div className="mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">MY PARTICIPATION</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">내 참여</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">내 출품 현황과 체험 기록, 당첨 결과를 확인해요. 방문자와 피드백 작성자 정보는 보여 주지 않아요.</p>
        </div>

        <section className="mt-8 grid gap-4" aria-labelledby="my-showcase-project-heading">
          <h2 id="my-showcase-project-heading" className="text-xl font-bold text-foreground">내 출품</h2>
          {project ? (
            <article className="grid gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{SHOWCASE_TYPE_LABELS[project.projectType]}</span>
                    <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{SHOWCASE_OWNER_STATUS_LABELS[project.status]}</span>
                  </div>
                  <h3 className="mt-2 break-words text-lg font-bold text-foreground">{project.title}</h3>
                  {project.teamName ? <p className="text-sm text-muted-foreground">{project.teamName}</p> : null}
                </div>
                <Button href={`/events/project-showcase/my/projects/${project.id}`} variant="secondary">출품 내용 보기</Button>
              </div>
              {project.status === "changes_requested" ? (
                <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm leading-6 text-foreground">운영진이 수정을 요청했어요. 사유를 확인하고 모집 기간 안에 다시 제출해 주세요.</p>
              ) : null}
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {metrics.map((metric) => (
                  <div key={metric.label} className="rounded-xl bg-surface-muted/60 p-4">
                    <dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt>
                    <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">{metric.value.toLocaleString("ko-KR")}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center">
              <p className="font-semibold text-foreground">출품한 프로젝트가 없어요</p>
              {phase === "submission" ? (
                <div className="mt-4"><Button href="/events/project-showcase/projects/new">출품하기</Button></div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  모집 기간: {formatShowcasePeriod(event?.submissionStartAt ?? null, event?.submissionEndAt ?? null)}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="mt-10 grid gap-4" aria-labelledby="my-showcase-experience-heading">
          <h2 id="my-showcase-experience-heading" className="text-xl font-bold text-foreground">체험과 추첨권</h2>
          <div className="rounded-2xl border border-dashed border-border bg-surface px-5 py-10 text-center">
            <p className="font-semibold text-foreground">체험 기간에 참여할 수 있어요</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              체험 기간: {formatShowcasePeriod(event?.experienceStartAt ?? null, event?.experienceEndAt ?? null)}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
