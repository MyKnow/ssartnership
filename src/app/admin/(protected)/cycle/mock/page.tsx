import AdminAllCertificationCardMocks from "@/components/admin/AdminAllCertificationCardMocks";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
import { getAdminAccountByLoginId } from "@/lib/admin-accounts";
import { listCohortCardThemes } from "@/lib/cohort-card-themes";
import { getMemberCanonicalProfile } from "@/lib/member-profile-view";

export const dynamic = "force-dynamic";
export default async function AdminCycleMockPage() {
  await requireAdminPermission("cycles", "read", { path: "/admin/cycle/mock" });
  const admin = await getAdminAccountByLoginId("myknow");
  const profile = admin ? await getMemberCanonicalProfile(admin.id) : null;
  const themes = await listCohortCardThemes();
  const member = { displayName: profile?.displayName ?? "정민호", campus: profile?.campus ?? "서울", profileImageUrl: profile ? `/api/admin/members/${encodeURIComponent(profile.id)}/avatar` : null };
  return <AdminShell title="전체 인증 카드 목업" backHref="/admin/cycle" backLabel="기수 관리"><div className="grid gap-6"><AdminPageHeader eyebrow="Cycle mock" title="전체 목업보기" description="운영진과 색상이 지정된 모든 기수의 인증 카드를 슈퍼 어드민 프로필로 확인합니다." /><AdminAllCertificationCardMocks themes={themes} member={member} initialTimestamp={new Date().toISOString()} /></div></AdminShell>;
}
