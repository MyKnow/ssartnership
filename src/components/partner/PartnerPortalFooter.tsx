import Link from "next/link";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import BrandWordmark from "@/components/BrandWordmark";
import { BUG_REPORT_EMAIL } from "@/lib/site";
import { getPartnerSession } from "@/lib/partner-session";

export default async function PartnerPortalFooter() {
  const session = await getPartnerSession();
  const authHref = session ? "/partner/logout" : "/partner/login";
  const authLabel = session ? "로그아웃" : "로그인";

  return (
    <footer className="border-t border-border bg-surface/90 py-6 backdrop-blur">
      <Container className="flex flex-col gap-4 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/partner"
            aria-label="협력사 포털 홈"
            className="inline-flex items-center text-foreground hover:opacity-80"
          >
            <BrandWordmark className="text-base sm:text-lg" />
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" href="/partner">
              대시보드
            </Button>
            <Button variant="ghost" href="/partner/setup">
              초기 설정
            </Button>
            <Button variant="ghost" href="/partner/change-password">
              비밀번호 변경
            </Button>
            <Button variant="ghost" href={authHref}>
              {authLabel}
            </Button>
            <Button variant="ghost" href="/" className="hidden sm:inline-flex">
              공개 홈
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-xs leading-6 sm:flex-row sm:items-center sm:justify-between">
          <p>협력사 담당자 전용 공간입니다. 정보 변경은 승인 절차를 거칩니다.</p>
          <a
            href={`mailto:${BUG_REPORT_EMAIL}`}
            className="font-medium text-foreground hover:opacity-80"
          >
            문의: {BUG_REPORT_EMAIL}
          </a>
        </div>
      </Container>
    </footer>
  );
}
