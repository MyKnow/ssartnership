import AdminShell from "@/components/admin/AdminShell";
import AdminMemberManager from "@/components/admin/AdminMemberManager";
import CertificationView from "@/components/certification/CertificationView";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";
import {
  mockPreviewCertificationMembers,
  mockPreviewMembers,
} from "@/lib/mock/member-preview";

export const dynamic = "force-dynamic";

async function noopMemberAction(formData: FormData) {
  "use server";
  void formData;
}

export default function AdminMemberMockPreviewPage() {
  const initialTimestamp = new Date().toISOString();

  return (
    <AdminShell
      title="운영진 Mock 미리보기"
      backHref="/admin/members"
      backLabel="회원 관리"
    >
      <div className="grid gap-6">
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeading
              title="운영진 UI 점검"
              description="실제 members 테이블을 건드리지 않고, 운영진 year=0 데이터가 인증 카드와 관리자 회원 관리에서 어떻게 보이는지 확인하는 전용 미리보기입니다."
            />
            <Button variant="ghost" href="/admin/members">
              실제 회원 관리로 돌아가기
            </Button>
          </div>
          <div className="mt-6 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-900 dark:text-sky-100">
            저장/삭제 버튼은 동작하지 않습니다. 검색, 필터, 기수 드롭다운에서
            `운영진` 표시와 카드 표현만 확인하면 됩니다.
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <SectionHeading
              title="인증 카드 예시 1"
              description="캠퍼스와 반이 있는 운영진 케이스"
            />
            <CertificationView
              member={mockPreviewCertificationMembers.withClass}
              initialTimestamp={initialTimestamp}
              disableTracking
            />
          </Card>

          <Card className="p-6">
            <SectionHeading
              title="인증 카드 예시 2"
              description="캠퍼스/반 정보가 없는 운영진 케이스"
            />
            <CertificationView
              member={mockPreviewCertificationMembers.noCampus}
              initialTimestamp={initialTimestamp}
              disableTracking
            />
          </Card>
        </div>

        <Card>
          <SectionHeading
            title="회원 관리 예시"
            description="운영진과 교육생이 섞인 목록으로, 검색/기수/반/캠퍼스 필터와 카드 표시를 함께 확인합니다."
          />
          <AdminMemberManager
            members={mockPreviewMembers}
            updateMember={noopMemberAction}
            deleteMember={noopMemberAction}
          />
        </Card>
      </div>
    </AdminShell>
  );
}
