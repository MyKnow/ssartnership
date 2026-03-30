import AdminShell from "@/components/admin/AdminShell";
import AdminMemberManager from "@/components/admin/AdminMemberManager";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import { deleteMember, updateMember } from "@/app/admin/(protected)/actions";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const supabase = getSupabaseAdminClient();
  const { data: members } = await supabase
    .from("members")
    .select(
      "id,mm_user_id,mm_username,display_name,year,campus,class_number,must_change_password,avatar_content_type,avatar_base64,created_at,updated_at",
    )
    .order("created_at", { ascending: false });

  const safeMembers = members ?? [];

  return (
    <AdminShell
      title="회원 관리"
      backHref="/admin"
      backLabel="관리 홈"
    >
      <Card>
        <SectionHeading
          title="회원 관리"
          description="교육생 계정의 표시 정보, 반, 비밀번호 변경 강제 여부를 관리할 수 있습니다."
        />
        {safeMembers.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="등록된 회원이 없습니다."
              description="회원가입이 완료된 교육생이 생기면 이곳에서 관리할 수 있습니다."
            />
          </div>
        ) : (
          <AdminMemberManager
            members={safeMembers}
            updateMember={updateMember}
            deleteMember={deleteMember}
          />
        )}
      </Card>
    </AdminShell>
  );
}
