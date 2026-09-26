import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ShowcaseExperiencePanel from "@/components/project-showcase/ShowcaseExperiencePanel";
import ShowcaseProjectViewRecorder from "@/components/project-showcase/ShowcaseProjectViewRecorder";
import Button from "@/components/ui/Button";
import { getHeaderSession } from "@/lib/header-session";
import { getShowcasePhase, projectShowcaseRepository } from "@/lib/project-showcase";
import { formatShowcasePeriod } from "@/lib/project-showcase/format";
import { SHOWCASE_TYPE_LABELS } from "@/lib/project-showcase/labels";
import type { ShowcaseProjectType } from "@/lib/project-showcase/types";
import { getSignedUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const EXPERIENCE_HINTS: Record<ShowcaseProjectType, string> = {
  web: "새 탭에서 서비스를 열어요.",
  app: "스토어나 다운로드 안내 페이지를 열어요. 설치 여부는 확인하지 않아요.",
  game: "새 탭에서 게임이나 스토어 페이지를 열어요.",
  embedded: "시연 영상을 열어 프로젝트를 살펴봐요.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  const project = await projectShowcaseRepository.getPublicProject(projectId);
  if (!project) return { title: "내 프로젝트를 소개합니다!", robots: { index: false } };
  return {
    title: `${project.title} | 내 프로젝트를 소개합니다!`,
    description: project.summary,
    openGraph: {
      title: project.title,
      description: project.summary,
      images: [{ url: project.imageUrl, alt: project.title }],
    },
  };
}

export default async function ShowcaseProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const [event, session] = await Promise.all([
    projectShowcaseRepository.getEvent(),
    getSignedUserSession(),
  ]);
  const phase = getShowcasePhase(event);
  const headerSession = await getHeaderSession(session?.userId);

  if (phase !== "experience") {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader initialSession={headerSession} />
        <main className="mx-auto w-full max-w-2xl px-4 pb-20 pt-12 sm:px-6">
          <section className="rounded-3xl border border-border bg-surface p-6 text-center sm:p-10">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">SSAFY PROJECT SHOWCASE</p>
            <h1 className="mt-3 text-2xl font-bold text-foreground">지금은 체험 기간이 아니에요</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              프로젝트는 체험 기간에만 공개돼요.
              <br />
              체험 기간: {formatShowcasePeriod(event?.experienceStartAt ?? null, event?.experienceEndAt ?? null)}
            </p>
            <div className="mt-6"><Button href="/events/project-showcase">이벤트 페이지로 가기</Button></div>
          </section>
        </main>
      </div>
    );
  }

  const project = await projectShowcaseRepository.getPublicProject(projectId);
  if (!project) notFound();
  const isOwner = Boolean(session?.userId && project.ownerMemberId === session.userId);
  const memberState = session?.userId && !isOwner
    ? await projectShowcaseRepository.getMemberProjectState(project.id, session.userId)
    : { registered: false, startedAt: null, feedbackSubmitted: false, interested: false };
  const loginHref = `/auth/login?returnTo=${encodeURIComponent(`/events/project-showcase/projects/${project.id}`)}`;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <ShowcaseProjectViewRecorder projectId={project.id} enabled={Boolean(session?.userId) && !isOwner} />
      <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <Button href="/events/project-showcase#showcase-gallery" variant="secondary" size="sm">프로젝트 목록</Button>
        <article className="mt-5 overflow-hidden rounded-3xl border border-border bg-surface">
          <div className="aspect-[4/3] max-h-[560px] overflow-hidden bg-surface-muted sm:aspect-[16/8]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.imageUrl} alt={`${project.title} 대표 이미지`} className="h-full w-full object-cover" />
          </div>
          <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
            <div>
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{SHOWCASE_TYPE_LABELS[project.projectType]}</span>
              <h1 className="mt-3 break-words text-3xl font-bold leading-tight text-foreground sm:text-4xl">{project.title}</h1>
              {project.teamName ? <p className="mt-1 text-sm font-medium text-muted-foreground">{project.teamName}</p> : null}
              <p className="mt-3 text-lg leading-7 text-muted-foreground">{project.summary}</p>
              <div className="mt-8 border-t border-border pt-6">
                <h2 className="text-lg font-bold text-foreground">서비스 소개</h2>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/85">{project.description}</p>
              </div>
            </div>
            <aside className="h-fit rounded-2xl border border-border bg-surface-muted/50 p-4 sm:p-5" aria-labelledby="showcase-experience-heading">
              <h2 id="showcase-experience-heading" className="font-bold text-foreground">체험하기</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{EXPERIENCE_HINTS[project.projectType]}</p>
              <div className="mt-5">
                <ShowcaseExperiencePanel
                  projectId={project.id}
                  serviceUrl={project.serviceUrl}
                  authenticated={Boolean(session?.userId)}
                  isOwner={isOwner}
                  loginHref={loginHref}
                  initialState={memberState}
                  serverNow={new Date().toISOString()}
                />
              </div>
            </aside>
          </div>
        </article>
      </main>
    </div>
  );
}
