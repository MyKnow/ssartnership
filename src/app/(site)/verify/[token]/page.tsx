import type { Metadata } from "next";
import Link from "next/link";
import AnalyticsEventOnMount from "@/components/analytics/AnalyticsEventOnMount";
import Badge from "@/components/ui/Badge";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { verifyCertificationQrToken } from "@/lib/certification-qr";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { SITE_NAME } from "@/lib/site";
import {
  getCertificationRoleLabel,
  getCertificationScheme,
} from "@/lib/certification-scheme";
import CertificationCardFrame from "@/components/certification/CertificationCardFrame";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `SSAFY 인증 QR 검증 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
} satisfies Metadata;

function formatDate(value: number) {
  return new Date(value).toLocaleString("ko-KR", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

export default async function CertificationVerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const headerSession = await getHeaderSession();
  const resolvedParams = await params;
  const rawToken = resolvedParams?.token
    ? decodeURIComponent(resolvedParams.token).trim()
    : "";
  const verification = verifyCertificationQrToken(rawToken);

  let member:
    | {
        id?: string | null;
        display_name?: string | null;
        year?: number | null;
        campus?: string | null;
        avatar_content_type?: string | null;
        avatar_base64?: string | null;
        must_change_password?: boolean | null;
      }
    | null = null;

  if (verification.ok) {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("members")
      .select(
        "id,display_name,year,campus,avatar_content_type,avatar_base64,must_change_password",
      )
      .eq("id", verification.payload.userId)
      .maybeSingle();

    if (data?.id && !data.must_change_password) {
      member = data;
    }
  }

  const isValid = verification.ok && Boolean(member);
  const profile = member ? parseSsafyProfile(member.display_name ?? "") : null;
  const roleLabel = member ? getCertificationRoleLabel(member.year) : null;
  const scheme = member ? getCertificationScheme(member.year) : null;
  const campusLabel = member?.campus ?? profile?.campus ?? null;
  const yearLabel = member?.year && member.year > 0 ? `${member.year}기` : null;
  const avatarSrc =
    member?.avatar_base64 && member.avatar_content_type
      ? `data:${member.avatar_content_type};base64,${member.avatar_base64}`
      : "/avatar-default.svg";
  const name = profile?.displayName ?? member?.display_name ?? "이름 미지정";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10">
          <AnalyticsEventOnMount
            eventName="certification_qr_verify"
            targetType="certification_qr"
            properties={{
              valid: isValid,
              reason: verification.ok ? "ok" : verification.reason,
              year: member?.year ?? null,
              campus: member?.campus ?? null,
              role: roleLabel,
            }}
            dedupeKey={`certification-verify:${rawToken}`}
          />

          <div className="mx-auto max-w-2xl">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold text-foreground">
                  SSAFY QR 검증
                </h1>
                <Badge
                  className={
                    isValid
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border border-danger/30 bg-danger/10 text-danger"
                  }
                >
                  {isValid ? `유효한 ${roleLabel ?? "인증"}` : "검증 실패"}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">
                QR 토큰의 서명과 만료시간을 확인한 뒤 현재 저장된 인증 정보를
                대조합니다.
              </p>

              {isValid && verification.ok && member && scheme ? (
                <CertificationCardFrame
                  scheme={scheme}
                  eyebrow="SSAFY 인증 검증"
                  name={name}
                  roleLabel={roleLabel ?? "인증"}
                  yearLabel={yearLabel}
                  campusLabel={campusLabel}
                  description=""
                  footer={
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={cn(
                            "inline-flex h-2 w-2 rounded-full",
                            scheme.accentClassName,
                          )}
                        />
                        <span className={scheme.subduedTextClassName}>
                          QR 토큰이 유효합니다.
                        </span>
                      </div>
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className={cn("text-xs font-medium uppercase tracking-[0.16em]", scheme.mutedTextClassName)}>
                            발급 시각
                          </span>
                          <span className="whitespace-nowrap font-semibold">
                            {formatDate(verification.payload.issuedAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className={cn("text-xs font-medium uppercase tracking-[0.16em]", scheme.mutedTextClassName)}>
                            만료 시각
                          </span>
                          <span className="whitespace-nowrap font-semibold">
                            {formatDate(verification.payload.expiresAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  }
                  avatarSrc={avatarSrc}
                  avatarAlt="프로필 이미지"
                />
              ) : (
                <div className="rounded-3xl border border-danger/30 bg-danger/10 p-5">
                  <p className="text-base font-semibold text-danger">
                    유효하지 않은 QR입니다.
                  </p>
                  <p className="mt-2 text-sm text-danger/90">
                    {verification.ok
                      ? "회원 정보가 일치하지 않거나 현재 인증 상태로 사용할 수 없습니다."
                      : verification.reason === "expired"
                        ? "QR 토큰이 만료되었습니다. 교육생증에서 새 QR을 다시 표시해 주세요."
                        : "QR 토큰 서명이 유효하지 않습니다."}
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <Link
                  href="/"
                  className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-foreground hover:border-strong"
                >
                  홈으로
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
