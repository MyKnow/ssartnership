import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import GraduateProfilePhotoForm from "@/components/graduate-verification/GraduateProfilePhotoForm";
import Card from "@/components/ui/Card";
import Container from "@/components/ui/Container";
import PageHeader from "@/components/ui/PageHeader";
import {
  buildMemberGateHref,
  getMemberGateCompletionReturnTo,
} from "@/lib/member-required-gates";
import { getUserSession } from "@/lib/user-auth";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: `본인 사진 변경 | ${SITE_NAME}`, robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ returnTo?: string | string[] }>;
};

export default async function CertificationPhotoPage({ searchParams }: PageProps) {
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = getMemberGateCompletionReturnTo(
    Array.isArray(rawReturnTo) ? rawReturnTo[0] : rawReturnTo,
    "profile-photo",
  );
  const session = await getUserSession();
  if (!session?.userId) {
    redirect(
      `/auth/login?returnTo=${encodeURIComponent(buildMemberGateHref("profile-photo", returnTo))}`,
    );
  }
  const blocked = session.requiresProfilePhotoUpdate;
  return <div className="min-h-screen bg-background"><SiteHeader /><main><Container className="pb-16 pt-10"><div className="mx-auto w-full max-w-2xl space-y-6"><PageHeader eyebrow="Member" title="본인 사진 변경" description={blocked ? "사진 검토가 완료될 때까지 인증 카드와 QR 검증을 사용할 수 없습니다. 새 사진을 제출해 주세요." : "새 사진은 관리자 검토가 끝난 뒤 인증 카드와 유효 QR 검증 화면에 반영됩니다."} {...(blocked ? {} : { backHref: "/certification", backLabel: "내 인증으로 돌아가기" })} /><Card><GraduateProfilePhotoForm returnTo={returnTo} /></Card></div></Container></main></div>;
}
