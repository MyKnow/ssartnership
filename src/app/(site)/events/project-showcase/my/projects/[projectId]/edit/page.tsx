import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ShowcaseProjectForm from "@/components/project-showcase/ShowcaseProjectForm";
import { getHeaderSession } from "@/lib/header-session";
import { getShowcasePhase, projectShowcaseRepository } from "@/lib/project-showcase";
import { canOwnerEditShowcaseProject } from "@/lib/project-showcase/types";
import { getSignedUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function EditMyShowcaseProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const projectPath = `/events/project-showcase/my/projects/${projectId}`;
  const session = await getSignedUserSession();
  if (!session?.userId) redirect(`/auth/login?returnTo=${encodeURIComponent(`${projectPath}/edit`)}`);
  const [event, project, ownerName, headerSession] = await Promise.all([
    projectShowcaseRepository.getEvent(),
    projectShowcaseRepository.getOwnerProject(session.userId, projectId),
    projectShowcaseRepository.getMemberDisplayName(session.userId),
    getHeaderSession(session.userId),
  ]);
  if (!project) notFound();
  if (!ownerName || !canOwnerEditShowcaseProject(project.status, getShowcasePhase(event))) redirect(projectPath);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <Link href={projectPath} className="text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">← 출품 내용으로 돌아가기</Link>
        <div className="mb-7 mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">EDIT SUBMISSION</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">출품 내용 수정</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">수정해서 다시 제출하면 운영진이 처음부터 다시 확인해요.</p>
        </div>
        {project.reviewNote ? (
          <div className="mb-6 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground">운영진 검수 사유</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{project.reviewNote}</p>
          </div>
        ) : null}
        <section className="rounded-3xl border border-border bg-surface p-5 sm:p-8">
          <ShowcaseProjectForm mode="edit" ownerName={ownerName} project={project} />
        </section>
      </main>
    </div>
  );
}
