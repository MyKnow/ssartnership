import { notFound } from "next/navigation";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import ShowcaseAdminProjectForm from "@/components/admin/ShowcaseAdminProjectForm";
import Button from "@/components/ui/Button";
import { requireAdminPermission } from "@/lib/admin-access";
import { projectShowcaseRepository } from "@/lib/project-showcase";
import { isUuid } from "@/lib/uuid";

export const dynamic = "force-dynamic";

export default async function EditAdminShowcaseProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireAdminPermission("events", "update", { path: "/admin/events/project-showcase" });
  const { projectId } = await params;
  const mockId = process.env.NEXT_PUBLIC_DATA_SOURCE === "mock" && /^[a-z0-9-]{1,128}$/iu.test(projectId);
  if (!isUuid(projectId) && !mockId) notFound();
  const project = await projectShowcaseRepository.getAdminProject(projectId);
  if (!project) notFound();

  return (
    <AdminShell title="쇼케이스 출품작 수정" backHref="/admin/events/project-showcase" backLabel="쇼케이스 운영">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="이벤트 운영"
          title="출품작 수정"
          description="출품자 외의 프로젝트 정보, 대표 이미지, 검수 상태와 사유를 수정할 수 있어요."
          actions={<Button href="/admin/events/project-showcase" variant="secondary">목록으로</Button>}
        />
        <ShowcaseAdminProjectForm mode="edit" project={project} />
      </div>
    </AdminShell>
  );
}
