import { notFound } from "next/navigation";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import ShowcaseAdminProjectForm from "@/components/admin/ShowcaseAdminProjectForm";
import Button from "@/components/ui/Button";
import { requireAdminPermission } from "@/lib/admin-access";
import { projectShowcaseRepository } from "@/lib/project-showcase";

export const dynamic = "force-dynamic";

const PAGE_PATH = "/admin/events/project-showcase/projects/new";

export default async function NewAdminShowcaseProjectPage() {
  await requireAdminPermission("events", "create", { path: PAGE_PATH });
  const event = await projectShowcaseRepository.getEvent();
  if (!event) notFound();

  return (
    <AdminShell title="쇼케이스 출품작 등록" backHref="/admin/events/project-showcase" backLabel="쇼케이스 운영">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="이벤트 운영"
          title="출품작 등록"
          description="기존 회원을 출품자로 선택해 프로젝트 정보를 등록합니다. 당첨 공지 동의가 확인된 경우에만 등록해 주세요."
          actions={<Button href="/admin/events/project-showcase" variant="secondary">목록으로</Button>}
        />
        <ShowcaseAdminProjectForm mode="create" />
      </div>
    </AdminShell>
  );
}
