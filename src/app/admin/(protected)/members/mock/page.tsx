import AdminShell from "@/components/admin/AdminShell";
import AdminMemberManager from "@/components/admin/AdminMemberManager";
import CertificationView from "@/components/certification/CertificationView";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SectionHeading from "@/components/ui/SectionHeading";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
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
      title="Mock 미리보기"
      backHref="/admin/members"
      backLabel="회원 관리"
    >
      <div className="grid gap-6">
        <ShellHeader
          eyebrow="QA Preview"
          title="회원 Mock UI 점검"
          description="운영진, 14기, 15기 샘플 데이터를 실제 관리자 레이아웃 안에서 검수하는 내부 미리보기입니다."
          actions={
            <Button variant="ghost" href="/admin/members">
              실제 회원 관리로 돌아가기
            </Button>
          }
        />
        <StatsRow
          items={[
            { label: "샘플 회원", value: `${mockPreviewMembers.length}명`, hint: "목업 데이터 기준" },
            { label: "인증 카드", value: "3종", hint: "운영진 · 15기 · 14기" },
          ]}
          minItemWidth="13rem"
        />
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <SectionHeading
              title="회원 Mock UI 점검"
              description="실제 members 테이블을 건드리지 않고, 14기·15기·운영진 데이터가 인증 카드와 관리자 회원 관리에서 어떻게 보이는지 확인하는 전용 미리보기입니다."
            />
          </div>
          <div className="mt-6 rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-900 dark:text-sky-100">
            저장/삭제 버튼은 동작하지 않습니다. 검색, 필터, 기수 드롭다운에서
            14기, 15기, 운영진 표시와 카드 표현만 확인하면 됩니다.
          </div>
        </Card>

        <div className="grid gap-6">
          <Card className="p-6">
            <SectionHeading
              title="운영진 카드 예시"
              description="운영진 year=0 인증 카드 표현"
            />
            <CertificationView
              member={mockPreviewCertificationMembers.staff}
              initialTimestamp={initialTimestamp}
              disableTracking
            />
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="p-6">
              <SectionHeading
                title="15기 카드 예시"
                description="15기 교육생 인증 카드 표현"
              />
              <CertificationView
                member={mockPreviewCertificationMembers.year15}
                initialTimestamp={initialTimestamp}
                disableTracking
              />
            </Card>

            <Card className="p-6">
              <SectionHeading
                title="14기 카드 예시"
                description="14기 교육생 인증 카드 표현"
              />
              <CertificationView
                member={mockPreviewCertificationMembers.year14}
                initialTimestamp={initialTimestamp}
                disableTracking
              />
            </Card>
          </div>
        </div>

        <Card>
          <SectionHeading
            title="회원 관리 예시"
            description="운영진과 14기·15기 교육생이 섞인 목록으로, 검색·기수·캠퍼스 필터와 카드 표시를 함께 확인합니다."
          />
          <AdminMemberManager
            members={mockPreviewMembers}
            activePolicyVersions={{
              service: 2,
              privacy: 2,
              marketing: 1,
            }}
            pagination={{
              totalCount: mockPreviewMembers.length,
              page: 1,
              pageSize: 50,
            }}
            filters={{
              searchValue: "",
              sortValue: "recent",
              filterValue: "all",
              yearFilter: "all",
              campusFilter: "all",
              serviceConsentFilter: "all",
              privacyConsentFilter: "all",
              marketingConsentFilter: "all",
              pushEnabledFilter: "all",
              announcementEnabledFilter: "all",
              newPartnerEnabledFilter: "all",
              expiringPartnerEnabledFilter: "all",
              reviewEnabledFilter: "all",
              mmEnabledFilter: "all",
              marketingEnabledFilter: "all",
            }}
            options={{
              campuses: Array.from(
                new Set(
                  mockPreviewMembers
                    .map((member) => member.campus)
                    .filter((campus): campus is string => Boolean(campus)),
                ),
              ),
              years: Array.from(
                new Set(
                  mockPreviewMembers
                    .map((member) => member.year)
                    .filter((year): year is number => typeof year === "number"),
                ),
              ).sort((a, b) => b - a),
            }}
            updateMember={noopMemberAction}
            deleteMember={noopMemberAction}
          />
        </Card>
      </div>
    </AdminShell>
  );
}
