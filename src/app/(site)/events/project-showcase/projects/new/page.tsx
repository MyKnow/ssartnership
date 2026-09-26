import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import ShowcaseProjectForm from "@/components/project-showcase/ShowcaseProjectForm";
import Button from "@/components/ui/Button";
import { getHeaderSession } from "@/lib/header-session";
import { getShowcasePhase, projectShowcaseRepository } from "@/lib/project-showcase";
import { formatShowcasePeriod } from "@/lib/project-showcase/format";
import { getSignedUserSession } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function NewShowcaseProjectPage() {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    redirect("/auth/login?returnTo=%2Fevents%2Fproject-showcase%2Fprojects%2Fnew");
  }
  const [event, ownerName, activeProject, headerSession] = await Promise.all([
    projectShowcaseRepository.getEvent(),
    projectShowcaseRepository.getMemberDisplayName(session.userId),
    projectShowcaseRepository.getActiveOwnerProject(session.userId),
    getHeaderSession(session.userId),
  ]);
  if (activeProject) redirect(`/events/project-showcase/my/projects/${activeProject.id}`);
  const submissionOpen = getShowcasePhase(event) === "submission";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
        <Link href="/events/project-showcase" className="text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">← 이벤트로 돌아가기</Link>
        <div className="mb-7 mt-7">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">PROJECT SUBMISSION</p>
          <h1 className="mt-2 text-3xl font-bold text-foreground">내 프로젝트 출품하기</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            운영진이 개발 참여 여부와 링크 접속을 확인한 뒤 출품을 확정해요. 확정된 프로젝트는 체험 기간에 공개돼요.
          </p>
        </div>

        {!submissionOpen ? (
          <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-foreground">지금은 모집 기간이 아니에요</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              모집 기간: {formatShowcasePeriod(event?.submissionStartAt ?? null, event?.submissionEndAt ?? null)}
            </p>
            <div className="mt-5"><Button href="/events/project-showcase" variant="secondary">이벤트 일정 보기</Button></div>
          </section>
        ) : ownerName ? (
          <section className="rounded-3xl border border-border bg-surface p-5 sm:p-8">
            <ShowcaseProjectForm mode="create" ownerName={ownerName} />
          </section>
        ) : (
          <section className="rounded-3xl border border-border bg-surface p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-foreground">회원 정보를 확인하지 못했어요</h2>
            <p className="mt-2 text-sm text-muted-foreground">로그아웃한 뒤 다시 로그인해 주세요.</p>
            <div className="mt-5"><Button href="/events/project-showcase" variant="secondary">이벤트로 돌아가기</Button></div>
          </section>
        )}
      </main>
    </div>
  );
}
