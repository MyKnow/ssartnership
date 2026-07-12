import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import GraduateProfilePhotoForm from "@/components/graduate-verification/GraduateProfilePhotoForm";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import { getSignedUserSession } from "@/lib/user-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `본인 사진 변경 | ${SITE_NAME}`, robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function CertificationPhotoPage() {
  const session = await getSignedUserSession();
  if (!session?.userId) redirect("/auth/login?returnTo=%2Fcertification%2Fphoto");
  const { data: member } = await getSupabaseAdminClient().from("members").select("graduate_verified_at").eq("id", session.userId).maybeSingle();
  if (!(member as { graduate_verified_at?: string | null } | null)?.graduate_verified_at) redirect("/certification");
  return <div className="min-h-screen bg-background"><SiteHeader /><main><Container className="pb-16 pt-10"><div className="mx-auto w-full max-w-2xl space-y-6"><PageHeader eyebrow="Member" title="본인 사진 변경" description="새 사진은 관리자 검토가 끝난 뒤 인증 카드와 유효 QR 검증 화면에 반영됩니다." backHref="/certification" backLabel="내 인증으로 돌아가기" /><Card><GraduateProfilePhotoForm /></Card></div></Container></main></div>;
}
