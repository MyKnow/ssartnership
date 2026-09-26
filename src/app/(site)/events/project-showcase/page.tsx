import type { Metadata } from "next";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import ShowcaseGuideSection from "@/components/project-showcase/ShowcaseGuideSection";
import ShowcaseProjectCard from "@/components/project-showcase/ShowcaseProjectCard";
import Button from "@/components/ui/Button";
import { getHeaderSession } from "@/lib/header-session";
import {
  getShowcaseNextMilestone,
  getShowcasePhase,
  projectShowcaseRepository,
  type ShowcasePhase,
} from "@/lib/project-showcase";
import { formatShowcaseDateTime, formatShowcasePeriod } from "@/lib/project-showcase/format";
import { SHOWCASE_PHASE_LABELS, SHOWCASE_PRIZES, SHOWCASE_TYPE_LABELS } from "@/lib/project-showcase/labels";
import { SHOWCASE_PROJECT_TYPES } from "@/lib/project-showcase/types";
import { getSignedUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const EVENT_PATH = "/events/project-showcase";
const NEW_PROJECT_PATH = `${EVENT_PATH}/projects/new`;
const MY_PATH = `${EVENT_PATH}/my`;

const PHASE_DESCRIPTIONS: Record<ShowcasePhase, string> = {
  setup: "운영진이 이벤트 일정을 준비하고 있어요. 일정이 정해지면 이곳에서 안내할게요.",
  paused: "운영진이 이벤트를 잠시 중단했어요. 다시 열리면 이곳에서 안내할게요.",
  upcoming: "곧 프로젝트 모집이 시작돼요. 출품할 서비스와 팀원 학번을 미리 준비해 주세요.",
  submission: "직접 개발·배포한 서비스를 출품해 주세요. 프로젝트는 체험 기간에 공개돼요.",
  reviewing: "모집이 끝났어요. 운영진이 출품작을 확인하고 있고, 체험 기간에 공개할게요.",
  experience: "동료가 만든 서비스를 체험하고 한 줄 피드백을 남겨 주세요. 피드백을 남긴 서비스마다 추첨권을 받아요.",
  verification: "체험이 끝났어요. 운영진이 참여 기록을 확인하고 추첨을 준비하고 있어요.",
  announcement: "당첨 결과를 발표했어요. 당첨자에게는 Mattermost로 경품을 보내 드려요.",
  closed: "이벤트가 끝났어요. 참여해 주셔서 감사합니다.",
};

const TIMELINE_INDEX: Partial<Record<ShowcasePhase, number>> = {
  submission: 0,
  experience: 1,
  verification: 2,
  announcement: 2,
};

export const metadata: Metadata = {
  title: "내 프로젝트를 소개합니다! | SSAFY 프로젝트 쇼케이스",
  description: "SSAFY 구성원이 직접 개발·배포한 웹·앱·게임·임베디드 프로젝트를 소개하고 함께 체험해 보세요.",
  openGraph: {
    title: "내 프로젝트를 소개합니다!",
    description: "SSAFY 구성원이 만든 서비스를 소개하고 함께 체험해 보세요.",
    images: [{ url: "/ads/project-showcase-banner.png", width: 1915, height: 821, alt: "SSAFY 프로젝트 쇼케이스" }],
  },
};

function firstParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function ProjectShowcasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [event, session] = await Promise.all([
    projectShowcaseRepository.getEvent(),
    getSignedUserSession(),
  ]);
  const phase = getShowcasePhase(event);
  const milestone = getShowcaseNextMilestone(event, phase);
  const selectedType = SHOWCASE_PROJECT_TYPES.find((type) => type === firstParam(params.type)) ?? "";
  const query = firstParam(params.q).trim().slice(0, 80);
  const selectedSort = params.sort === "title" ? "title" : "newest";
  const showResults = phase === "announcement" || phase === "closed";
  const [projects, ownProject, completedProjectIds, winners, drawState, headerSession] = await Promise.all([
    phase === "experience"
      ? projectShowcaseRepository.listPublicProjects({ type: selectedType, query, sort: selectedSort })
      : Promise.resolve([]),
    session?.userId ? projectShowcaseRepository.getActiveOwnerProject(session.userId) : Promise.resolve(null),
    phase === "experience" && session?.userId
      ? projectShowcaseRepository.listMemberCompletedProjectIds(session.userId)
      : Promise.resolve([]),
    showResults ? projectShowcaseRepository.listPublicWinners() : Promise.resolve([]),
    showResults ? projectShowcaseRepository.getDrawState() : Promise.resolve(null),
    getHeaderSession(session?.userId),
  ]);
  const completed = new Set(completedProjectIds);

  const primaryAction = (() => {
    if (phase === "submission") {
      if (!session?.userId) {
        return { href: `/auth/login?returnTo=${encodeURIComponent(NEW_PROJECT_PATH)}`, label: "로그인 후 출품하기" };
      }
      return ownProject
        ? { href: `${MY_PATH}/projects/${ownProject.id}`, label: "내 출품 보기" }
        : { href: NEW_PROJECT_PATH, label: "출품하기" };
    }
    if (phase === "experience") return { href: "#showcase-gallery", label: "프로젝트 둘러보기" };
    if (phase === "announcement") return { href: "#showcase-results", label: "결과 확인" };
    return null;
  })();
  const activeStep = TIMELINE_INDEX[phase] ?? -1;
  const steps = [
    { label: "프로젝트 모집", period: formatShowcasePeriod(event?.submissionStartAt ?? null, event?.submissionEndAt ?? null) },
    { label: "체험·피드백", period: formatShowcasePeriod(event?.experienceStartAt ?? null, event?.experienceEndAt ?? null) },
    { label: "추첨·결과 발표", period: formatShowcasePeriod(event?.announcementStartAt ?? null, null) },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <section className="relative isolate overflow-hidden rounded-3xl bg-slate-950">
          <div className="relative aspect-[21/9] min-h-56 w-full sm:min-h-80">
            <Image
              src="/ads/project-showcase-banner.png"
              alt="SSAFY 구성원이 만든 프로젝트를 소개하고 직접 체험하는 프로젝트 쇼케이스"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 1200px"
              className="object-cover"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent px-5 pb-5 pt-20 text-white sm:px-8 sm:pb-8">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-200 sm:text-sm">SSAFY PROJECT SHOWCASE</p>
            <h1 className="max-w-3xl text-2xl font-bold leading-tight sm:text-4xl">내 프로젝트를 소개합니다!</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">
              <span className="block">SSAFY 구성원이 직접 만든 서비스를</span>
              <span className="block">소개하고 함께 체험해 보세요</span>
            </p>
          </div>
        </section>

        <section className="mt-5 grid gap-4 rounded-3xl border border-border bg-surface p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-6" aria-label="이벤트 진행 상태">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{SHOWCASE_PHASE_LABELS[phase]}</span>
              {milestone ? (
                <span className="text-sm font-medium text-foreground">
                  {milestone.label} · {formatShowcaseDateTime(milestone.at, { withTime: true })}
                </span>
              ) : null}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{PHASE_DESCRIPTIONS[phase]}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {session?.userId ? <Button href={MY_PATH} variant="secondary">내 참여</Button> : null}
            {primaryAction ? <Button href={primaryAction.href}>{primaryAction.label}</Button> : null}
          </div>
        </section>

        <ol aria-label="이벤트 일정" className="mt-6 grid gap-3 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.label}
              aria-current={index === activeStep ? "step" : undefined}
              className={`rounded-2xl border p-4 ${index === activeStep ? "border-primary/50 bg-primary/5" : "border-border bg-surface"}`}
            >
              <p className="text-xs font-bold text-primary">0{index + 1}</p>
              <p className="mt-2 font-semibold text-foreground">{step.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{step.period}</p>
            </li>
          ))}
        </ol>

        {phase === "submission" || phase === "upcoming" ? (
          <section className="mt-12 rounded-3xl border border-border bg-surface p-5 sm:p-7" aria-labelledby="showcase-submission-guide">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">SUBMISSION GUIDE</p>
            <h2 id="showcase-submission-guide" className="mt-2 text-2xl font-bold text-foreground">출품 전에 준비해 주세요</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["배포·운영 중인 서비스 주소", "Web·Game은 서비스 주소, App은 스토어나 다운로드 안내 주소, Embedded는 YouTube·Vimeo 시연 영상 주소"],
                ["대표 홍보 이미지 1장", "4:3 비율로 잘라 저장해요. 서비스 화면이 잘 보이는 이미지를 권장해요."],
                ["서비스 설명", "한 줄 소개와 20자 이상의 설명. 주요 기능과 이용 방법을 알려 주세요."],
                ["참여자 이름·학번", "학번은 숫자 7자리예요. 팀 출품은 팀명과 팀원 모두의 이름·학번이 필요해요."],
              ].map(([title, body]) => (
                <li key={title} className="rounded-2xl bg-surface-muted/60 p-4">
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {phase === "experience" ? (
          <section id="showcase-gallery" className="mt-12 scroll-mt-24" aria-labelledby="showcase-projects-heading">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">PROJECT GALLERY</p>
                <h2 id="showcase-projects-heading" className="mt-2 text-2xl font-bold text-foreground">프로젝트 둘러보기</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {projects.length.toLocaleString("ko-KR")}개 프로젝트
                {session?.userId ? ` · 체험 완료 ${completed.size.toLocaleString("ko-KR")}개` : ""}
              </p>
            </div>
            <form action={EVENT_PATH} className="mb-5 grid gap-2 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_150px_150px_auto] sm:items-center">
              <label className="sr-only" htmlFor="showcase-search">프로젝트 검색</label>
              <input id="showcase-search" name="q" type="search" defaultValue={query} placeholder="서비스 이름, 팀명, 설명 검색" className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
              <label className="sr-only" htmlFor="showcase-type">프로젝트 유형</label>
              <select id="showcase-type" name="type" defaultValue={selectedType} className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <option value="">전체 유형</option>
                {SHOWCASE_PROJECT_TYPES.map((type) => <option key={type} value={type}>{SHOWCASE_TYPE_LABELS[type]}</option>)}
              </select>
              <label className="sr-only" htmlFor="showcase-sort">정렬 방식</label>
              <select id="showcase-sort" name="sort" defaultValue={selectedSort} className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <option value="newest">최신 등록순</option>
                <option value="title">이름순</option>
              </select>
              <Button type="submit" variant="secondary">적용</Button>
            </form>
            {projects.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => <ShowcaseProjectCard key={project.id} project={project} completed={completed.has(project.id)} />)}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border bg-surface px-5 py-14 text-center">
                <p className="text-lg font-semibold text-foreground">{query || selectedType ? "조건에 맞는 프로젝트가 없어요" : "공개된 프로젝트가 아직 없어요"}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{query || selectedType ? "검색어나 유형을 바꿔 다시 찾아보세요." : "운영진이 확인을 마친 프로젝트부터 공개돼요."}</p>
              </div>
            )}
          </section>
        ) : null}

        {phase === "announcement" || phase === "closed" ? (
          <section id="showcase-results" className="mt-12 scroll-mt-24 rounded-3xl border border-border bg-surface p-5 sm:p-7" aria-labelledby="showcase-results-heading">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">ANNOUNCEMENT</p>
            <h2 id="showcase-results-heading" className="mt-2 text-2xl font-bold text-foreground">당첨 결과</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              무작위 추첨 결과예요. 이름·학번은 일부를 가려 보여 주고, 경품은 당첨자 Mattermost로 보내 드려요.
              {session?.userId ? " 내 당첨 여부는 내 참여에서 확인할 수 있어요." : ""}
            </p>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {(["submitter", "experiencer"] as const).map((group) => {
                const groupWinners = winners.filter((winner) => winner.candidateGroup === group);
                const drawn = group === "submitter" ? drawState?.submitterDrawn : drawState?.experiencerDrawn;
                return (
                  <div key={group} className="rounded-2xl bg-surface-muted/60 p-4">
                    <h3 className="font-bold text-foreground">{SHOWCASE_PRIZES[group].title}</h3>
                    <p className="text-xs text-muted-foreground">{SHOWCASE_PRIZES[group].prize} · {groupWinners.length}{SHOWCASE_PRIZES[group].unit}</p>
                    {groupWinners.length > 0 ? (
                      <ol className="mt-3 grid gap-1.5">
                        {groupWinners.map((winner) => (
                          <li key={`${group}-${winner.position}`} className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-surface px-3 py-2 text-sm">
                            <span className="min-w-0 break-words font-medium text-foreground">{winner.projectTitle ?? winner.maskedName}</span>
                            <span className="tabular-nums text-muted-foreground">{winner.projectTitle ? `${winner.maskedName} · ` : ""}{winner.maskedStudentNumber}</span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">{drawn ? "이번 분야는 당첨자가 없어요." : "추첨 결과를 준비하고 있어요."}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <ShowcaseGuideSection event={event} />
      </main>
    </div>
  );
}
