import type { ReactNode } from "react";
import Link from "next/link";
import {
  BellIcon,
  BugAntIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  LockClosedIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import PwaInstallButton from "@/components/PwaInstallButton";
import ThemeModeButtons from "@/components/ThemeModeButtons";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import {
  GITHUB_URL,
  SITE_NAME,
} from "@/lib/site";
import { BUG_REPORT_HREF } from "@/lib/support-mail";
import BrandWordmark from "@/components/BrandWordmark";

const githubHandle = new URL(GITHUB_URL).pathname.replace(/^\/+/, "");

function FooterSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="grid h-full content-start grid-rows-[auto_1fr] gap-3 self-start">
      <p className="ui-kicker">{title}</p>
      <div className="grid content-start auto-rows-max gap-2">{children}</div>
    </div>
  );
}

export default function Footer() {
  return (
    <footer
      data-site-footer
      className="border-t border-border/70 bg-surface-overlay/90 py-6 backdrop-blur-xl"
    >
      <Container className="grid gap-8 text-sm text-muted-foreground" size="wide">
        <div className="grid gap-4">
          <Link
            href="/"
            aria-label={SITE_NAME}
            className="inline-flex items-center text-foreground hover:opacity-80"
          >
            <BrandWordmark className="text-base sm:text-lg" />
          </Link>
          <p className="text-xs leading-6">
            Copyright © 2026 {SITE_NAME}. All rights reserved.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          <FooterSection title="운영">
            <Button variant="secondary" href="/admin" className="w-full justify-start gap-2">
              <ShieldCheckIcon className="h-5 w-5" />
              관리자
            </Button>
            <Button variant="secondary" href="/partner" className="w-full justify-start gap-2">
              <BuildingOfficeIcon className="h-5 w-5" />
              파트너 포털
            </Button>
          </FooterSection>

          <FooterSection title="문의">
            <Button variant="secondary" href={BUG_REPORT_HREF} className="w-full justify-start gap-2">
              <BugAntIcon className="h-5 w-5" />
              버그 제보
            </Button>
            <Button variant="secondary" href="/suggest" className="w-full justify-start gap-2">
              <MegaphoneIcon className="h-5 w-5" />
              제휴 제안
            </Button>
            <Button
              variant="secondary"
              href="/partner-registration"
              className="w-full justify-start gap-2"
            >
              <BuildingOfficeIcon className="h-5 w-5" />
              신규 파트너사 등록
            </Button>
            <Button
              variant="secondary"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="w-full justify-start gap-2"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.34-3.79-1.34-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 .1.71 2.08 3.25 1.23.1-.72.4-1.21.72-1.49-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.97 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.63 0c2.14-1.45 3.09-1.15 3.09-1.15.61 1.54.23 2.69.11 2.97.73.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.04.76 2.1v3.1c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z" /></svg>
              {githubHandle}
            </Button>
          </FooterSection>

          <FooterSection title="설정">
            <div data-site-footer-theme-mode>
              <ThemeModeButtons />
            </div>
            <PwaInstallButton variant="secondary" className="w-full justify-start" />
            <div data-site-footer-notifications>
              <Button
                variant="secondary"
                href="/notifications"
                className="w-full justify-start gap-2"
              >
                <BellIcon className="h-5 w-5" />
                알림센터
              </Button>
            </div>
          </FooterSection>

          <FooterSection title="약관">
            <Button variant="secondary" href="/legal/service" className="w-full justify-start gap-2">
              <DocumentTextIcon className="h-5 w-5" />
              이용약관
            </Button>
            <Button variant="secondary" href="/legal/privacy" className="w-full justify-start gap-2">
              <LockClosedIcon className="h-5 w-5" />
              개인정보 처리방침
            </Button>
            <Button variant="secondary" href="/legal/marketing" className="w-full justify-start gap-2">
              <MegaphoneIcon className="h-5 w-5" />
              마케팅
            </Button>
          </FooterSection>
        </div>
      </Container>
    </footer>
  );
}
