import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import Button from "@/components/ui/Button";
import { getHeaderSession } from "@/lib/header-session";
import { getShowcasePhase, projectShowcaseRepository } from "@/lib/project-showcase";
import { formatShowcasePeriod } from "@/lib/project-showcase/format";
import { SHOWCASE_OWNER_STATUS_LABELS, SHOWCASE_PRIZES, SHOWCASE_TYPE_LABELS } from "@/lib/project-showcase/labels";
import { getSignedUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function MyShowcaseParticipationPage() {
  const session = await getSignedUserSession();
  if (!session?.userId) redirect("/auth/login?returnTo=%2Fevents%2Fproject-showcase%2Fmy");
  const [event, projects, participation, winnings, headerSession] = await Promise.all([
    projectShowcaseRepository.getEvent(),
    projectShowcaseRepository.listOwnerProjects(session.userId),
    projectShowcaseRepository.getMemberParticipation(session.userId),
    projectShowcaseRepository.getMemberWinnings(session.userId),
    getHeaderSession(session.userId),
  ]);
  const phase = getShowcasePhase(event);

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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="my-showcase-project-heading" className="text-xl font-bold text-foreground">내 출품 · {projects.length}개</h2>
            {phase === "submission" ? <Button href="/events/project-showcase/projects/new">프로젝트 출품하기</Button> : null}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">승인된 프로젝트 {projects.filter((project) => project.status === "approved").length}개 · 출품작마다 추첨 기회가 1개씩 생겨요. 경품은 출품·체험을 통틀어 한 사람당 1개예요.</p>
          {projects.length > 0 ? projects.map((project) => (
            <article key={project.id} className="grid gap-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
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
                {[
                  { label: "고유 조회", value: project.viewCount },
                  { label: "체험 시작", value: project.experienceCount },
                  { label: "피드백", value: project.validExperienceCount },
                  { label: "관심 표시", value: project.interestCount },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl bg-surface-muted/60 p-4">
                    <dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt>
                    <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">{metric.value.toLocaleString("ko-KR")}</dd>
                  </div>
                ))}
              </dl>
            </article>
          )) : (
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

        {phase === "announcement" || phase === "closed" ? (
          <section className="mt-8 grid gap-3" aria-labelledby="my-showcase-result-heading">
            <h2 id="my-showcase-result-heading" className="text-xl font-bold text-foreground">당첨 결과</h2>
            {winnings.length > 0 ? winnings.map((winning) => (
              <div key={winning.candidateGroup} className="rounded-2xl border border-success/30 bg-success/10 px-5 py-4">
                <p className="font-bold text-foreground">축하해요! {SHOWCASE_PRIZES[winning.candidateGroup].title}에 당첨됐어요.</p>
                <p className="mt-1 text-sm text-foreground">
                  {SHOWCASE_PRIZES[winning.candidateGroup].prize}{winning.projectTitle ? ` · ${winning.projectTitle}` : ""}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{winning.deliveredAt ? "경품 발송을 완료했어요." : "등록된 MM 또는 이메일로 구글폼 작성 안내를 보내 드려요. 학번은 해당 폼에서 확인해요."}</p>
              </div>
            )) : (
              <div className="rounded-2xl border border-border bg-surface px-5 py-4 text-sm text-muted-foreground">
                이번에는 당첨되지 않았어요. 참여해 주셔서 감사해요.
              </div>
            )}
          </section>
        ) : null}

        <section className="mt-10 grid gap-4" aria-labelledby="my-showcase-experience-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="my-showcase-experience-heading" className="text-xl font-bold text-foreground">체험과 추첨권</h2>
            {phase === "experience" ? <Button href="/events/project-showcase#showcase-gallery" variant="secondary">프로젝트 둘러보기</Button> : null}
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <dt className="text-xs font-medium text-muted-foreground">보유 추첨권</dt>
              <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">{participation.ticketCount.toLocaleString("ko-KR")}장</dd>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <dt className="text-xs font-medium text-muted-foreground">체험한 프로젝트</dt>
              <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">{participation.experiences.length.toLocaleString("ko-KR")}개</dd>
            </div>
            <div className="col-span-2 rounded-xl border border-border bg-surface p-4 sm:col-span-1">
              <dt className="text-xs font-medium text-muted-foreground">참여 등록</dt>
              <dd className="mt-2 text-sm font-semibold text-foreground">
                {participation.registration ? "완료" : "아직 등록하지 않았어요"}
              </dd>
            </div>
          </dl>
          <p className="text-xs leading-5 text-muted-foreground">
            체험을 시작하고 1분 뒤 한 줄 피드백을 남긴 프로젝트 1개마다 추첨권 1장을 받아요. 같은 프로젝트를 여러 번 체험해도 1장이에요.
          </p>
          {participation.experiences.length > 0 ? (
            <ul className="grid gap-2">
              {participation.experiences.map((experience) => (
                <li key={experience.projectId}>
                  <Link
                    href={`/events/project-showcase/projects/${experience.projectId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="min-w-0 truncate font-medium text-foreground">{experience.projectTitle}</span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${experience.feedbackSubmitted ? "bg-success/10 text-success" : "bg-warning/10 text-foreground"}`}>
                      {experience.feedbackSubmitted ? "추첨권 1장" : "피드백 대기"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-surface px-5 py-8 text-center">
              <p className="font-semibold text-foreground">{phase === "experience" ? "아직 체험한 프로젝트가 없어요" : "체험 기간에 참여할 수 있어요"}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                체험 기간: {formatShowcasePeriod(event?.experienceStartAt ?? null, event?.experienceEndAt ?? null)}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
