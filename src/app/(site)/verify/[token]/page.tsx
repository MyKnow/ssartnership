import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { verifyCertificationQrToken } from "@/lib/certification-qr";
import { parseSsafyProfile } from "@/lib/mm-profile";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "교육생 QR 검증 | SSARTNERSHIP",
  robots: {
    index: false,
    follow: false,
  },
};

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
  const resolvedParams = await params;
  const rawToken = resolvedParams?.token
    ? decodeURIComponent(resolvedParams.token).trim()
    : "";
  const verification = verifyCertificationQrToken(rawToken);

  let member:
    | {
        mm_username: string;
        display_name?: string | null;
        campus?: string | null;
        class_number?: number | null;
        must_change_password?: boolean | null;
      }
    | null = null;

  if (verification.ok) {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("members")
      .select("mm_username,display_name,campus,class_number,must_change_password")
      .eq("id", verification.payload.userId)
      .maybeSingle();

    if (
      data?.mm_username &&
      !data.must_change_password &&
      data.mm_username === verification.payload.mmUsername
    ) {
      member = data;
    }
  }

  const isValid = verification.ok && Boolean(member);
  const profile = member
    ? parseSsafyProfile(member.display_name ?? member.mm_username)
    : null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <Container className="pb-16 pt-10">
          <Card className="mx-auto max-w-xl p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold text-foreground">
                  교육생 QR 검증
                </h1>
                <Badge
                  className={
                    isValid
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border border-danger/30 bg-danger/10 text-danger"
                  }
                >
                  {isValid ? "유효한 교육생" : "검증 실패"}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">
                QR 토큰의 서명과 만료시간을 확인한 뒤 현재 저장된 교육생 정보를
                대조합니다.
              </p>

              {isValid && verification.ok && member ? (
                <div className="rounded-3xl border border-border bg-surface-muted p-5">
                  <div className="grid gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        SSAFY Trainee Verified
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">
                        {profile?.displayName ?? member.display_name ?? member.mm_username}
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {member.campus ?? "캠퍼스"}{" "}
                        {member.class_number ? `${member.class_number}반` : ""}
                      </p>
                    </div>

                    <div className="grid gap-3 rounded-2xl border border-border bg-surface p-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">MM 아이디</span>
                        <span className="font-semibold text-foreground">
                          @{member.mm_username}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">발급 시각</span>
                        <span className="font-semibold text-foreground">
                          {formatDate(verification.payload.issuedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">만료 시각</span>
                        <span className="font-semibold text-foreground">
                          {formatDate(verification.payload.expiresAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
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
          </Card>
        </Container>
      </main>
    </div>
  );
}
