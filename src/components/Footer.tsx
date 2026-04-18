import type { ReactNode } from "react";
import Link from "next/link";
import { FaGithub, FaInstagram } from "react-icons/fa";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import CampusFooterSelect from "@/components/CampusFooterSelect";
import PwaInstallButton from "@/components/PwaInstallButton";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import {
  BUG_REPORT_EMAIL,
  GITHUB_URL,
  INSTAGRAM_URL,
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
    <footer className="border-t border-border/70 bg-surface-overlay/90 py-6 backdrop-blur-xl">
      <Container
        className="grid items-start gap-8 text-sm text-muted-foreground lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]"
        size="wide"
      >
        <div className="grid gap-4">
          <Link
            href="/"
            aria-label={SITE_NAME}
            className="inline-flex items-center text-foreground hover:opacity-80"
          >
            <BrandWordmark className="text-base sm:text-lg" />
          </Link>
          <p className="max-w-xl leading-6">
            서울 캠퍼스 제휴와 혜택, 공지와 정책을 한곳에서 확인합니다.
          </p>
          <div className="grid gap-1 text-xs leading-6">
            <p>Copyright © 2026 {SITE_NAME}. All rights reserved.</p>
            <a
              href={BUG_REPORT_HREF}
              className="font-medium text-foreground hover:opacity-80"
            >
              {BUG_REPORT_EMAIL}
            </a>
          </div>
        </div>

        <FooterSection title="탐색">
          <CampusFooterSelect className="w-full" />
          <Button variant="secondary" href="/admin" className="w-full justify-start gap-2">
            <ShieldCheckIcon className="h-5 w-5" />
            관리자
          </Button>
        </FooterSection>

        <FooterSection title="지원">
          <Button variant="secondary" href={BUG_REPORT_HREF} className="w-full justify-start">
            버그 제보
          </Button>
          <Button variant="secondary" href="/partner" className="w-full justify-start">
            파트너 포털
          </Button>
        </FooterSection>

        <FooterSection title="바로가기">
          <PwaInstallButton variant="secondary" className="w-full justify-start" />
          <Button
            variant="secondary"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="w-full justify-start gap-2"
          >
            <FaGithub className="h-5 w-5" />
            {githubHandle}
          </Button>
          <Button
            variant="secondary"
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noreferrer"
            className="w-full justify-start gap-2"
          >
            <FaInstagram className="h-5 w-5 text-[#E1306C]" />
            @myknow00
          </Button>
        </FooterSection>

        <FooterSection title="정책">
          <Button variant="secondary" href="/legal/service" className="w-full justify-start">
            이용약관
          </Button>
          <Button variant="secondary" href="/legal/privacy" className="w-full justify-start">
            개인정보 처리방침
          </Button>
          <Button variant="secondary" href="/legal/marketing" className="w-full justify-start">
            마케팅
          </Button>
        </FooterSection>
      </Container>
    </footer>
  );
}
