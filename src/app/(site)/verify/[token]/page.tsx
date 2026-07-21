import type { Metadata } from "next";
import AnalyticsEventOnMount from "@/components/analytics/AnalyticsEventOnMount";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SiteHeader from "@/components/SiteHeader";
import { getHeaderSession } from "@/lib/header-session";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import { verifyCertificationQrToken } from "@/lib/certification-qr";
import {
  getMemberCanonicalProfile,
  type MemberCanonicalProfile,
} from "@/lib/member-profile-view";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { SITE_NAME } from "@/lib/site";
import {
  getCertificationRoleLabel,
  getCertificationScheme,
} from "@/lib/certification-scheme";
import CertificationCardFrame from "@/components/certification/CertificationCardFrame";
import { cn } from "@/lib/cn";
import { formatKoreanDateTimeToSecond } from "@/lib/datetime";
import { listCohortCardThemes } from "@/lib/cohort-card-themes";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `SSAFY 인증 QR 검증 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
} satisfies Metadata;

function formatDate(value: number) {
  return formatKoreanDateTimeToSecond(value);
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

  let member: MemberCanonicalProfile | null = null;

  if (verification.ok) {
    const profile = await getMemberCanonicalProfile(verification.payload.userId);

    if (
      profile?.id
      && !profile.mustChangePassword
      && profile.profilePhotoReviewStatus === "approved"
    ) {
      member = profile;
    }
  }

  const isValid = verification.ok && Boolean(member);
  const cohortCardThemes = member ? await listCohortCardThemes() : [];
  const profile = member ? parseSsafyProfile(member.displayName ?? "") : null;
  const generation = member?.generation ?? null;
  const roleLabel = member
    ? getCertificationRoleLabel(generation, { graduateVerifiedAt: member.graduateVerifiedAt })
    : null;
  const scheme = member
    ? getCertificationScheme(generation, cohortCardThemes, { graduateVerifiedAt: member.graduateVerifiedAt })
    : null;
  const campusLabel = member?.campus ?? profile?.campus ?? null;
  const yearLabel = generation && generation > 0 ? `${generation}기` : null;
  const avatarSrc = member?.activeProfileImageId
    ? `/api/certification/avatar/${encodeURIComponent(rawToken)}`
    : "/avatar-default.svg";
  const name = profile?.displayName ?? member?.displayName ?? "이름 미지정";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <AnalyticsEventOnMount
            eventName="certification_qr_verify"
            targetType="certification_qr"
            path="/verify/[token]"
            properties={{
              valid: isValid,
              reason: verification.ok ? "ok" : verification.reason,
              generation,
              campus: member?.campus ?? null,
              role: roleLabel,
            }}
            dedupeKey={`certification-verify:${rawToken}`}
          />

          <div className="mx-auto max-w-4xl space-y-6">
            <ShellHeader
              eyebrow="Verification"
              title="SSAFY QR 검증"
              description="QR 토큰의 서명과 만료시간을 확인한 뒤 현재 저장된 인증 정보를 대조합니다."
              actions={
                <Badge variant={isValid ? "success" : "danger"}>
                  {isValid ? `유효한 ${roleLabel ?? "인증"}` : "검증 실패"}
                </Badge>
              }
            />

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
                  <div className="min-w-0 space-y-[clamp(0.5rem,1.5cqw,1.5rem)]">
                    <div className="flex min-w-0 items-center gap-[clamp(0.35rem,1cqw,1rem)] text-[clamp(0.65rem,1.6cqw,1rem)]">
                      <span
                        className={cn(
                          "inline-flex h-2 w-2 rounded-full",
                          scheme.accentClassName,
                        )}
                      />
                      <span className={cn("min-w-0 truncate", scheme.subduedTextClassName)}>
                        QR 토큰이 유효합니다.
                      </span>
                    </div>
                    <div className="grid min-w-0 gap-[clamp(0.35rem,1cqw,1rem)] text-[clamp(0.65rem,1.8cqw,1rem)]">
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-[clamp(0.5rem,2cqw,2rem)] gap-y-1">
                        <span
                          className={cn(
                            "shrink-0 text-[clamp(0.6rem,1.4cqw,0.875rem)] font-medium uppercase tracking-[0.16em]",
                            scheme.mutedTextClassName,
                          )}
                        >
                          발급 시각
                        </span>
                        <span className="min-w-0 truncate text-right whitespace-nowrap font-semibold">
                          {formatDate(verification.payload.issuedAt)}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-[clamp(0.5rem,2cqw,2rem)] gap-y-1">
                        <span
                          className={cn(
                            "shrink-0 text-[clamp(0.6rem,1.4cqw,0.875rem)] font-medium uppercase tracking-[0.16em]",
                            scheme.mutedTextClassName,
                          )}
                        >
                          만료 시각
                        </span>
                        <span className="min-w-0 truncate text-right whitespace-nowrap font-semibold">
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
              <Card className="space-y-2 border-danger/30 bg-danger/10">
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
              </Card>
            )}

            <div className="flex justify-end">
              <Button href="/" variant="secondary">
                홈으로
              </Button>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
