import Button from "@/components/ui/Button";
import { SHOWCASE_PRIZES } from "@/lib/project-showcase/labels";
import { getShowcasePrizeClaim, SHOWCASE_CLAIM_DEADLINE_LABEL } from "@/lib/project-showcase/results";
import type { ProjectShowcaseRepository } from "@/lib/project-showcase/repository";

type Winnings = Awaited<ReturnType<ProjectShowcaseRepository["getMemberWinnings"]>>;

export default function ShowcasePrizeClaimSection({ winnings, drawn, now = new Date() }: {
  winnings: Winnings;
  drawn: boolean;
  now?: Date;
}) {
  return (
    <section id="showcase-results" className="grid gap-4" aria-labelledby="showcase-personal-results-heading">
      <h2 id="showcase-personal-results-heading" className="text-xl font-bold text-foreground">내 당첨 결과</h2>
      {winnings.length > 0 ? winnings.map((winning) => {
        const claim = getShowcasePrizeClaim(winning.candidateGroup, winning.deliveredAt, now);
        return (
          <article key={winning.candidateGroup} className="grid gap-4 rounded-2xl border border-success/30 bg-surface p-5 sm:p-6">
            <div>
              <p className="text-sm font-semibold text-success">{SHOWCASE_PRIZES[winning.candidateGroup].title} 당첨</p>
              <h3 className="mt-2 text-lg font-bold text-foreground">{SHOWCASE_PRIZES[winning.candidateGroup].prize}</h3>
              {winning.projectTitle ? <p className="mt-1 break-words text-sm text-muted-foreground">{winning.projectTitle}</p> : null}
            </div>
            {claim.status === "open" ? (
              <>
                <p className="text-sm leading-6 text-muted-foreground">
                  {SHOWCASE_CLAIM_DEADLINE_LABEL}(한국 시간)까지 이름·전화번호·학번을 입력해 주세요. 학번은 15 또는 16으로 시작하는 숫자 7자리예요.
                </p>
                <div><Button href={claim.formUrl} target="_blank" rel="noopener noreferrer">{winning.candidateGroup === "submitter" ? "출품" : "체험"} 경품 수령 폼 작성</Button></div>
              </>
            ) : claim.status === "delivered" ? (
              <p className="text-sm text-muted-foreground">경품 발송을 완료했어요.</p>
            ) : (
              <>
                <p className="text-sm leading-6 text-muted-foreground">경품 수령 정보 접수가 마감됐어요. 문의가 있으면 운영진에게 MM으로 연락해 주세요.</p>
                <div><Button disabled>수령 폼 접수 마감</Button></div>
              </>
            )}
          </article>
        );
      }) : (
        <div className="rounded-2xl border border-border bg-surface p-5 text-sm leading-6 text-muted-foreground">
          {drawn ? "이번에는 당첨되지 않았어요. 함께 참여해 주셔서 감사합니다." : "당첨 결과를 준비하고 있어요. 추첨이 완료되면 이곳에서 확인할 수 있어요."}
        </div>
      )}
    </section>
  );
}
