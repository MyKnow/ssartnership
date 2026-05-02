import type { ReactNode } from "react";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import {
  BellIcon,
  BugAntIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  LockClosedIcon,
  MegaphoneIcon,
  UserCircleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import CampusFooterSelect from "@/components/CampusFooterSelect";
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
    <footer className="border-t border-border/70 bg-surface-overlay/90 py-6 backdrop-blur-xl">
      <Container className="grid gap-8 text-sm text-muted-foreground" size="wide">
        <div className="grid gap-4">
          <Link
            href="/"
            aria-label={SITE_NAME}
            className="inline-flex items-center text-foreground hover:opacity-80"
          >
            <BrandWordmark className="text-base sm:text-lg" />
          </Link>
          <p className="max-w-xl leading-6">
            SSAFY 구성원을 위한 제휴 혜택, 공지와 정책을 한곳에서 확인합니다.
          </p>
          <p className="text-xs leading-6">
            Copyright © 2026 {SITE_NAME}. All rights reserved.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-5">
          <FooterSection title="캠퍼스">
            <CampusFooterSelect className="w-full" />
          </FooterSection>

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
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="w-full justify-start gap-2"
            >
              <FaGithub className="h-5 w-5" />
              {githubHandle}
            </Button>
          </FooterSection>

          <FooterSection title="설정">
            <ThemeModeButtons />
            <PwaInstallButton variant="secondary" className="w-full justify-start" />
            <Button variant="secondary" href="/notifications" className="w-full justify-start gap-2">
              <BellIcon className="h-5 w-5" />
              알림센터
            </Button>
            <Button
              variant="secondary"
              href="/certification"
              className="w-full justify-start gap-2"
            >
              <UserCircleIcon className="h-5 w-5" />
              내 프로필 설정
            </Button>
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
