import AdminShell from "@/components/admin/AdminShell";
import AdminMemberManualAddPanel from "@/components/admin/AdminMemberManualAddPanel";
import AdminMemberManager from "@/components/admin/AdminMemberManager";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SubmitButton from "@/components/ui/SubmitButton";
import SectionHeading from "@/components/ui/SectionHeading";
import {
  backfillMemberProfiles,
  deleteMember,
  manualAddMembers,
  updateMember,
} from "@/app/admin/(protected)/actions";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    backfill?: string;
    checked?: string;
    updated?: string;
    skipped?: string;
    failures?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const supabase = getSupabaseAdminClient();
  const { data: members } = await supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,staff_source_year,campus,must_change_password,avatar_content_type,avatar_base64,created_at,updated_at",
    )
    .order("created_at", { ascending: false });

  const safeMembers = members ?? [];

  return (
    <AdminShell
      title="회원 관리"
      backHref="/admin"
      backLabel="관리 홈"
    >
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            title="회원 관리"
            description="회원의 표시 정보와 비밀번호 변경 강제 여부를 관리할 수 있습니다."
          />
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" href="/admin/members/mock">
              Mock 미리보기
            </Button>
            <form action={backfillMemberProfiles}>
              <SubmitButton pendingText="백필 중">
                지금 백필 실행
              </SubmitButton>
            </form>
          </div>
        </div>

        {params.backfill ? (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
              params.backfill === "partial"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                : params.backfill === "error"
                  ? "border-danger/30 bg-danger/10 text-danger"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            }`}
          >
            <p className="font-semibold">
              {params.backfill === "partial"
                ? "백필이 일부만 완료되었습니다."
                : params.backfill === "error"
                  ? "백필 중 오류가 발생했습니다."
                  : "백필이 완료되었습니다."}
            </p>
            <p className="mt-1 text-xs leading-5">
              {params.checked ? `대상 ${params.checked}명 · ` : ""}
              {params.updated ? `변경 ${params.updated}명 · ` : ""}
              {params.skipped ? `변경 없음 ${params.skipped}명 · ` : ""}
              {params.failures ? `실패 ${params.failures}명` : ""}
            </p>
          </div>
        ) : null}
      </Card>

      <Card>
        <SectionHeading
          title="유저 수동 추가"
          description="MM 아이디를 입력하면 해당 기수에서 찾아 임시 비밀번호를 전송하고, 비밀번호 변경이 필요하도록 저장합니다. 운영진은 15기에서 먼저 찾고 없으면 14기에서 찾습니다."
        />
        <div className="mt-6">
          <AdminMemberManualAddPanel action={manualAddMembers} />
        </div>
      </Card>

      {safeMembers.length === 0 ? (
        <Card>
          <EmptyState
            title="등록된 회원이 없습니다."
            description="회원가입이 완료된 교육생이 생기면 이곳에서 관리할 수 있습니다."
          />
        </Card>
      ) : (
        <Card>
          <AdminMemberManager
            members={safeMembers}
            updateMember={updateMember}
            deleteMember={deleteMember}
          />
        </Card>
      )}
    </div>
  </AdminShell>
  );
}
