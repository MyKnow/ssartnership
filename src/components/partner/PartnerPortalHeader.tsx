import Link from "next/link";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import BrandWordmark from "@/components/BrandWordmark";
import { getPartnerSession } from "@/lib/partner-session";

export default async function PartnerPortalHeader() {
  const session = await getPartnerSession();
  const authHref = session ? "/partner/logout" : "/partner/login";
  const authLabel = session ? "로그아웃" : "로그인";

  return (
    <header className="border-b border-border bg-surface/90 backdrop-blur">
      <Container className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/partner"
            aria-label="업체 포털 홈"
            className="inline-flex items-center text-foreground hover:opacity-80"
          >
            <BrandWordmark className="text-lg sm:text-xl" />
          </Link>
          <span className="rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            업체 포털
          </span>
        </div>

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
      </Container>
    </header>
  );
}
