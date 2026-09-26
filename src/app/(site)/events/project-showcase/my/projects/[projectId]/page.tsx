import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ShowcaseWithdrawButton from "@/components/project-showcase/ShowcaseWithdrawButton";
import Button from "@/components/ui/Button";
import { getHeaderSession } from "@/lib/header-session";
import { getShowcasePhase, projectShowcaseRepository } from "@/lib/project-showcase";
import { SHOWCASE_OWNER_STATUS_LABELS, SHOWCASE_TYPE_LABELS } from "@/lib/project-showcase/labels";
import {
  canOwnerEditShowcaseProject,
  canOwnerWithdrawShowcaseProject,
  type ShowcaseProjectStatus,
} from "@/lib/project-showcase/types";
import { getSignedUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

const STATUS_GUIDANCE: Record<ShowcaseProjectStatus, string> = {
  pending: "운영진이 개발 참여 여부와 링크 접속을 확인하고 있어요. 확인 전에는 내용을 수정할 수 있어요.",
  approved: "출품이 확정됐어요. 체험 기간에 이벤트 페이지에 공개돼요.",
  changes_requested: "운영진이 수정을 요청했어요. 아래 사유를 확인하고 모집 기간 안에 다시 제출해 주세요.",
  rejected: "이번 이벤트에는 출품할 수 없어요. 아래 사유를 확인해 주세요.",
  hidden: "운영진이 이 프로젝트를 비공개로 전환했어요.",
  withdrawn: "출품을 취소했어요.",
};

export default async function MyShowcaseProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await getSignedUserSession();
  if (!session?.userId) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(`/events/project-showcase/my/projects/${projectId}`)}`);
  }
  const [event, project, headerSession] = await Promise.all([
    projectShowcaseRepository.getEvent(),
    projectShowcaseRepository.getOwnerProject(session.userId, projectId),
    getHeaderSession(session.userId),
  ]);
  if (!project) notFound();
  const phase = getShowcasePhase(event);
  const feedback = await projectShowcaseRepository.listOwnerFeedback(session.userId, project.id);
  const metrics = [
    { label: "고유 조회", value: project.viewCount },
    { label: "체험 시작", value: project.experienceCount },
    { label: "피드백", value: project.validExperienceCount },
    { label: "관심 표시", value: project.interestCount },
  ];
  const canEdit = canOwnerEditShowcaseProject(project.status, phase);
  const canWithdraw = canOwnerWithdrawShowcaseProject(project.status, phase);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <Link href="/events/project-showcase/my" className="text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">← 내 참여로 돌아가기</Link>

        <section className="mt-7 grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="my-showcase-status-heading">
          <div className="flex flex-wrap items-center gap-2">
            <h1 id="my-showcase-status-heading" className="text-lg font-bold text-foreground">출품 상태</h1>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{SHOWCASE_OWNER_STATUS_LABELS[project.status]}</span>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{STATUS_GUIDANCE[project.status]}</p>
          {project.reviewNote && project.status !== "approved" ? (
            <div className="rounded-xl bg-surface-muted/70 px-4 py-3">
              <p className="text-xs font-semibold text-muted-foreground">운영진 검수 사유</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{project.reviewNote}</p>
            </div>
          ) : null}
          {canEdit || canWithdraw ? (
            <div className="flex flex-wrap items-start gap-2 pt-1">
              {canEdit ? <Button href={`/events/project-showcase/my/projects/${project.id}/edit`}>수정하기</Button> : null}
              {canWithdraw ? <ShowcaseWithdrawButton projectId={project.id} /> : null}
            </div>
          ) : null}
        </section>

        {project.status === "approved" ? (
          <section className="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6" aria-labelledby="my-showcase-feedback-heading">
            <h2 id="my-showcase-feedback-heading" className="text-lg font-bold text-foreground">받은 반응</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl bg-surface-muted/60 p-4">
                  <dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt>
                  <dd className="mt-2 text-2xl font-bold tabular-nums text-foreground">{metric.value.toLocaleString("ko-KR")}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="font-semibold text-foreground">한 줄 피드백 <span className="text-sm font-normal text-muted-foreground">작성자 정보 없이 보여요</span></h3>
              {feedback.length > 0 ? (
                <ul className="mt-3 grid gap-2">
                  {feedback.map((item) => (
                    <li key={item.id} className="whitespace-pre-wrap break-words rounded-xl bg-surface-muted/60 px-4 py-3 text-sm leading-6 text-foreground">{item.body}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{phase === "experience" ? "아직 받은 피드백이 없어요." : "체험 기간이 시작되면 피드백이 이곳에 모여요."}</p>
              )}
            </div>
          </section>
        ) : null}

        <article className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface">
          <div className="aspect-video w-full overflow-hidden bg-surface-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.imageUrl} alt={`${project.title} 대표 이미지`} className="h-full w-full object-cover" />
          </div>
          <div className="grid gap-6 p-5 sm:p-8">
            <div>
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{SHOWCASE_TYPE_LABELS[project.projectType]}</span>
              <h2 className="mt-3 break-words text-2xl font-bold text-foreground sm:text-3xl">{project.title}</h2>
              {project.teamName ? <p className="mt-1 text-sm font-medium text-muted-foreground">{project.teamName}</p> : null}
              <p className="mt-3 text-base leading-7 text-muted-foreground">{project.summary}</p>
            </div>
            <div className="border-t border-border pt-5">
              <h3 className="font-bold text-foreground">서비스 설명</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/85">{project.description}</p>
            </div>
            <div className="border-t border-border pt-5">
              <h3 className="font-bold text-foreground">체험 주소</h3>
              <a href={project.serviceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all text-sm font-semibold text-primary underline">{project.serviceUrl}</a>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
