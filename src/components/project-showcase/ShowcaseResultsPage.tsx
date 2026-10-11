import SiteHeader from "@/components/SiteHeader";
import Button from "@/components/ui/Button";
import { getHeaderSession } from "@/lib/header-session";
import { projectShowcaseRepository } from "@/lib/project-showcase";
import { SHOWCASE_CLAIM_DEADLINE_AT, SHOWCASE_CLAIM_DEADLINE_LABEL } from "@/lib/project-showcase/results";
import ShowcasePrizeClaimSection from "./ShowcasePrizeClaimSection";

const EVENT_PATH = "/events/project-showcase";

/** Called only after the event's results publication boundary. Identity comes from the signed server session. */
export default async function ShowcaseResultsPage({ userId, now = new Date() }: { userId: string | null; now?: Date }) {
  const [headerSession, projects, winnings, drawState] = await Promise.all([
    getHeaderSession(userId ?? undefined),
    userId ? projectShowcaseRepository.listOwnerProjects(userId) : Promise.resolve([]),
    userId ? projectShowcaseRepository.getMemberWinnings(userId) : Promise.resolve([]),
    userId ? projectShowcaseRepository.getDrawState() : Promise.resolve(null),
  ]);
  const ownedProjects = projects.filter((project) => project.ownerMemberId === userId);
  const reviews = userId ? await Promise.all(ownedProjects.map(async (project) => ({
    project,
    feedback: await projectShowcaseRepository.listOwnerFeedback(userId, project.id),
  }))) : [];
  const claimClosed = now.getTime() >= Date.parse(SHOWCASE_CLAIM_DEADLINE_AT);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <p className="text-sm font-semibold text-primary">내 프로젝트를 소개합니다! · 이벤트 종료</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-foreground sm:text-4xl">리뷰·당첨 결과 확인</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">참여해 주셔서 감사합니다. 내 출품작에 남겨진 리뷰와 본인 당첨 여부를 확인할 수 있어요.</p>

        <section className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5" aria-label="경품 수령 안내">
          <p className="font-bold text-foreground">{claimClosed ? "경품 수령 정보 접수 마감" : `수령 폼 작성 · ${SHOWCASE_CLAIM_DEADLINE_LABEL}까지`}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{claimClosed ? "제출 기한이 지났어요. 문의는 운영진에게 MM으로 보내 주세요." : "당첨자는 아래에 표시되는 본인 당첨 분야의 구글폼을 작성해 주세요. 제출 기한은 한국 시간 기준이에요."}</p>
        </section>

        {userId ? (
          <div className="mt-8 grid gap-10">
            <ShowcasePrizeClaimSection winnings={winnings} drawn={Boolean(drawState?.submitterDrawn && drawState.experiencerDrawn)} now={now} />
            <section className="grid gap-4" aria-labelledby="showcase-owner-reviews-heading">
              <div>
                <h2 id="showcase-owner-reviews-heading" className="text-xl font-bold text-foreground">내 출품작 리뷰</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">내 출품작에 남겨진 리뷰를 읽어 보세요.</p>
              </div>
              {reviews.length > 0 ? reviews.map(({ project, feedback }) => (
                <article key={project.id} className="min-w-0 rounded-2xl border border-border bg-surface p-5 sm:p-6">
                  <h3 className="break-words text-lg font-bold text-foreground">{project.title}</h3>
                  <details className="mt-4" open>
                    <summary className="cursor-pointer text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">받은 리뷰 {feedback.length}개</summary>
                    {feedback.length > 0 ? (
                      <ul className="mt-3 grid gap-3">
                        {feedback.map((item) => <li key={item.id} className="whitespace-pre-wrap break-words rounded-xl bg-surface-inset px-4 py-3 text-sm leading-6 text-foreground">{item.body}</li>)}
                      </ul>
                    ) : <p className="mt-3 text-sm text-muted-foreground">아직 표시할 리뷰가 없어요.</p>}
                  </details>
                  <div className="mt-5"><Button href={`${EVENT_PATH}/my/projects/${project.id}`} variant="secondary">출품 내용 보기</Button></div>
                </article>
              )) : <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted-foreground">출품한 프로젝트가 없어요. 체험에 참여했다면 위에서 본인 당첨 여부를 확인해 주세요.</p>}
            </section>
          </div>
        ) : (
          <section className="mt-8 grid justify-items-start gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-label="로그인 후 본인 결과 확인">
            <h2 className="text-lg font-bold text-foreground">로그인하고 내 결과를 확인해 주세요</h2>
            <p className="text-sm leading-6 text-muted-foreground">본인 출품작 리뷰와 당첨 여부, 경품 수령 폼은 로그인한 본인에게만 보여요.</p>
            <Button href={`/auth/login?returnTo=${encodeURIComponent(EVENT_PATH)}`}>로그인 후 결과 확인</Button>
          </section>
        )}
      </main>
    </div>
  );
}
