import Link from "next/link";
import Container from "@/components/ui/Container";
import BrandWordmark from "@/components/BrandWordmark";
import ThemeToggle from "@/components/ThemeToggle";
import { BUG_REPORT_EMAIL } from "@/lib/site";
import { getPartnerSession } from "@/lib/partner-session";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import PartnerPortalActionLinks from "@/components/partner/PartnerPortalActionLinks";

export default async function PartnerPortalFooter() {
  const session = await getPartnerSession();

  return (
    <footer className="border-t border-border/70 bg-surface-overlay/92 py-6 backdrop-blur-xl">
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
            <ThemeToggle />
            <PartnerPortalActionLinks session={session} isMock={isPartnerPortalMock} />
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
