import { SHOWCASE_PRIZES } from "@/lib/project-showcase/labels";
import type { ShowcaseEvent } from "@/lib/project-showcase/types";

const SUBMITTER_STEPS = [
  "모집 기간에 서비스 이름, 주소, 홍보 이미지, 설명, 참여자 이름·학번을 제출해요.",
  "운영진이 개발 참여 여부와 링크 접속을 확인해요. 수정 요청을 받으면 모집 기간 안에 고쳐서 다시 제출할 수 있어요.",
  "확정된 프로젝트는 체험 기간에 공개되고, 받은 관심 표시와 피드백을 내 참여에서 확인해요.",
];

const EXPERIENCER_STEPS = [
  "체험 기간에 한 번 참여 등록(학번 입력)을 해요.",
  "관심 있는 서비스에서 체험 시작을 누르고 직접 이용해 봐요.",
  "1분이 지나면 한 줄 피드백을 남길 수 있어요. 피드백을 남긴 서비스 1개마다 추첨권 1장을 받아요.",
];

const NOTICES = [
  "참가자 1명은 프로젝트 1개에만 참여할 수 있어요. 팀 출품은 대표자가 제출하고, 당첨되면 대표자에게 보내 드려요.",
  "모든 당첨자는 무작위 추첨으로 정해요. 관심 표시·조회 수·인기는 추첨에 영향을 주지 않아요.",
  "출품과 체험을 통틀어 한 사람은 경품을 1개만 받을 수 있어요. 중복 당첨되면 다시 추첨해요.",
  "같은 서비스를 여러 번 체험해도 추첨권은 1장이에요. 외부인, 중복 계정, 허위 체험 기록은 추첨에서 제외해요.",
  "당첨자는 Mattermost에 이름·학번 일부를 가려(예: 정** · 15****43) 공지하고, 경품은 Mattermost로 보내 드려요.",
  "학번과 체험·피드백 기록은 경품 정산을 마친 뒤 30일이 지나면 파기해요. 출품자에게는 작성자 정보 없이 피드백 내용과 집계만 전달해요.",
];

export default function ShowcaseGuideSection({ event }: { event: ShowcaseEvent | null }) {
  const prizes = [
    { ...SHOWCASE_PRIZES.submitter, count: event?.submitterSelectionCount ?? 20 },
    { ...SHOWCASE_PRIZES.experiencer, count: event?.experiencerSelectionCount ?? 25 },
  ];

  return (
    <section className="mt-12 grid gap-6" aria-labelledby="showcase-guide-heading">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">HOW TO JOIN</p>
        <h2 id="showcase-guide-heading" className="mt-2 text-2xl font-bold text-foreground">참여 방법과 경품</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {prizes.map((prize) => (
          <div key={prize.title} className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-sm font-semibold text-primary">{prize.title}</p>
            <p className="mt-2 text-lg font-bold text-foreground">{prize.prize}</p>
            <p className="mt-1 text-sm text-muted-foreground">추첨 {prize.count.toLocaleString("ko-KR")}{prize.unit}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: "출품자", steps: SUBMITTER_STEPS },
          { title: "체험자", steps: EXPERIENCER_STEPS },
        ].map((group) => (
          <div key={group.title} className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="font-bold text-foreground">{group.title}</h3>
            <ol className="mt-3 grid gap-3">
              {group.steps.map((step, index) => (
                <li key={step} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 text-sm leading-6 text-foreground/85">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <details className="rounded-2xl border border-border bg-surface p-5 [&_summary::-webkit-details-marker]:hidden">
        <summary className="cursor-pointer list-none font-bold text-foreground">
          유의사항 <span className="ml-1 text-sm font-normal text-muted-foreground">추첨·개인정보 기준</span>
        </summary>
        <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm leading-6 text-muted-foreground">
          {NOTICES.map((notice) => <li key={notice}>{notice}</li>)}
        </ul>
      </details>
    </section>
  );
}
