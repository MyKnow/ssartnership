import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import ShellHeader from "@/components/ui/ShellHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CertificationCardFrame from "@/components/certification/CertificationCardFrame";
import { getHeaderSession } from "@/lib/header-session";
import { SITE_NAME } from "@/lib/site";
import { listCohortCardThemes } from "@/lib/cohort-card-themes.server";
import {
  getCertificationRoleLabel,
  getCertificationScheme,
} from "@/lib/certification-scheme";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { formatKoreanDateTimeToSecond } from "@/lib/datetime";
import { cn } from "@/lib/cn";
import { getWalletPassEligibilityMessage } from "@/lib/wallet/wallet-pass-eligibility";
import {
  decodeWalletPassTokenSegment,
  resolveWalletVerifyState,
} from "./verify-state";
import {
  getServerActionLogContext,
  scheduleProductEventLog,
} from "@/lib/activity-logs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: `Apple Wallet 패스 검증 | ${SITE_NAME}`,
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

function getStatusCopy(
  state: Awaited<ReturnType<typeof resolveWalletVerifyState>>,
) {
  switch (state.kind) {
    case "valid":
      return {
        badgeLabel: "검증 완료",
        badgeVariant: "primary" as const,
        title: "Apple Wallet 회원 인증을 확인했습니다.",
        description:
          "이 패스는 현재 기준으로 유효하며, 저장된 회원 자격과 승인된 본인 사진이 일치합니다.",
      };
    case "revoked":
      return {
        badgeLabel: "폐기됨",
        badgeVariant: "warning" as const,
        title: "폐기된 Apple Wallet 패스입니다.",
        description:
          "이 패스는 더 이상 사용할 수 없습니다. 회원에게 최신 패스를 다시 받아 달라고 안내해 주세요.",
      };
    case "ineligible":
      return {
        badgeLabel: "자격 상실",
        badgeVariant: "warning" as const,
        title: "현재 회원 자격으로는 이 패스를 사용할 수 없습니다.",
        description: getWalletPassEligibilityMessage(state.reason),
      };
    case "consent_required":
      return {
        badgeLabel: "재동의 필요",
        badgeVariant: "warning" as const,
        title: "Wallet 데이터 이용 동의가 만료된 패스입니다.",
        description:
          "현재 패스로는 인증할 수 없습니다. 회원에게 내 인증 화면에서 다시 동의하고 패스를 받아 달라고 안내해 주세요.",
      };
    case "outdated":
      return {
        badgeLabel: "정보 갱신 필요",
        badgeVariant: "warning" as const,
        title: "회원 정보와 일치하지 않는 이전 패스입니다.",
        description:
          "현재 패스로는 인증할 수 없습니다. 회원에게 내 인증 화면에서 최신 패스를 다시 받아 달라고 안내해 주세요.",
      };
    default:
      return {
        badgeLabel: "검증 실패",
        badgeVariant: "danger" as const,
        title: "유효하지 않은 Apple Wallet 패스입니다.",
        description:
          "토큰이 올바르지 않거나 더 이상 조회할 수 없는 패스입니다. 회원에게 인증 화면에서 다시 발급해 달라고 안내해 주세요.",
      };
  }
}

export default async function AppleWalletVerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  noStore();

  const headerSession = await getHeaderSession();
  const resolvedParams = await params;
  const rawToken = decodeWalletPassTokenSegment(resolvedParams?.token);
  const state = await resolveWalletVerifyState(rawToken);
  const copy = getStatusCopy(state);
  const logContext = await getServerActionLogContext(
    "/wallet/verify/[token]",
  );
  scheduleProductEventLog({
    ...logContext,
    path: "/wallet/verify/[token]",
    actorType: "guest",
    eventName: "wallet_pass_verify",
    targetType: "wallet_pass",
    properties: { platform: "apple", result: state.kind },
  });

  let validCard: React.ReactNode = null;

  if (state.kind === "valid") {
    const cohortCardThemes = await listCohortCardThemes();
    const profile = parseSsafyProfile(
      state.member.displayName ?? state.member.mattermostUsername ?? "",
    );
    const generation = state.member.generation ?? 0;
    const roleLabel = getCertificationRoleLabel(generation, {
      graduateVerifiedAt: state.member.graduateVerifiedAt,
    });
    const scheme = getCertificationScheme(generation, cohortCardThemes, {
      graduateVerifiedAt: state.member.graduateVerifiedAt,
    });
    const campusLabel = state.member.campus ?? profile.campus ?? null;
    const yearLabel = generation > 0 ? `${generation}기` : null;
    const displayName =
      profile.displayName ?? state.member.displayName ?? "이름 미지정";

    validCard = (
      <CertificationCardFrame
        scheme={scheme}
        eyebrow="싸트너십 회원 인증"
        name={displayName}
        roleLabel={roleLabel}
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
                Apple Wallet 패스와 현재 회원 인증 상태가 일치합니다.
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
                  패스 상태
                </span>
                <span className="min-w-0 truncate text-right whitespace-nowrap font-semibold">
                  유효
                </span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-[clamp(0.5rem,2cqw,2rem)] gap-y-1">
                <span
                  className={cn(
                    "shrink-0 text-[clamp(0.6rem,1.4cqw,0.875rem)] font-medium uppercase tracking-[0.16em]",
                    scheme.mutedTextClassName,
                  )}
                >
                  확인 시각
                </span>
                <span className="min-w-0 truncate text-right whitespace-nowrap font-semibold">
                  {formatKoreanDateTimeToSecond(new Date())}
                </span>
              </div>
            </div>
          </div>
        }
        avatarSrc={`/api/wallet/apple/avatar/${encodeURIComponent(rawToken)}`}
        avatarAlt="회원 프로필 이미지"
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader initialSession={headerSession} />
      <main>
        <Container className="pb-16 pt-10" size="wide">
          <div className="mx-auto max-w-4xl space-y-6">
            <ShellHeader
              eyebrow="Verification"
              title="Apple Wallet 패스 검증"
              description="토큰을 현재 회원 자격과 실시간으로 대조한 결과만 표시합니다."
              actions={<Badge variant={copy.badgeVariant}>{copy.badgeLabel}</Badge>}
            />

            {state.kind === "valid" && validCard ? (
              validCard
            ) : (
              <Card className="space-y-2">
                <p className="text-base font-semibold text-foreground">
                  {copy.title}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {copy.description}
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
