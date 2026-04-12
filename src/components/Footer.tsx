import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import PwaInstallButton from "@/components/PwaInstallButton";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import {
  BUG_REPORT_EMAIL,
  GITHUB_URL,
  SITE_NAME,
  SUGGESTION_URL,
} from "@/lib/site";
import BrandWordmark from "@/components/BrandWordmark";

export default function Footer() {
  return (
    <footer className="border-t border-border/70 bg-surface-overlay/90 py-6 backdrop-blur-xl">
      <Container className="flex flex-col gap-4 text-sm text-muted-foreground" size="wide">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            aria-label={SITE_NAME}
            className="inline-flex items-center text-foreground hover:opacity-80"
          >
            <BrandWordmark className="text-base sm:text-lg" />
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              size="icon"
              ariaLabel="Github"
              title="Github"
            >
              <FaGithub className="h-5 w-5" />
            </Button>
            <Button variant="secondary" href={`mailto:${BUG_REPORT_EMAIL}`}>
              버그 제보
            </Button>
            <Button variant="secondary" href={SUGGESTION_URL}>
              제휴 제안
            </Button>
            <Button variant="secondary" href="/legal/service">
              이용약관
            </Button>
            <Button variant="secondary" href="/legal/privacy">
              개인정보 처리방침
            </Button>
            <PwaInstallButton />
            <Button
              variant="secondary"
              href="/admin"
              size="icon"
              ariaLabel="Admin"
              title="Admin"
            >
              <ShieldCheckIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>Copyright © 2026 {SITE_NAME}. All rights reserved.</p>
          <a
            href={`mailto:${BUG_REPORT_EMAIL}`}
            className="font-medium text-foreground hover:opacity-80"
          >
            {BUG_REPORT_EMAIL}
          </a>
        </div>
      </Container>
    </footer>
  );
}
