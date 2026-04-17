import Link from "next/link";
import Container from "@/components/ui/Container";
import BrandWordmark from "@/components/BrandWordmark";
import ThemeToggle from "@/components/ThemeToggle";
import { getPartnerSession } from "@/lib/partner-session";
import { isPartnerPortalMock } from "@/lib/partner-portal";
import PartnerPortalActionLinks from "@/components/partner/PartnerPortalActionLinks";

export default async function PartnerPortalHeader() {
  const session = await getPartnerSession();

  return (
    <header className="border-b border-border/70 bg-surface-overlay/95 shadow-[var(--shadow-flat)] backdrop-blur-xl">
      <Container className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link
            href="/partner"
            aria-label="협력사 포털 홈"
            className="inline-flex items-center text-foreground hover:opacity-80"
          >
            <BrandWordmark className="text-lg sm:text-xl" />
          </Link>
          <span className="rounded-full border border-border bg-surface-muted/80 px-3 py-1 text-xs font-medium text-muted-foreground">
            협력사 포털
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <ThemeToggle />
          <PartnerPortalActionLinks
            session={session}
            isMock={isPartnerPortalMock}
            logoutIconOnly
            showPublicHome={false}
          />
        </div>
      </Container>
    </header>
  );
}
