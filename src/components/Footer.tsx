"use client";

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

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface/90 py-6 backdrop-blur">
      <Container className="flex flex-col gap-4 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground">
            {SITE_NAME}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              size="icon"
              ariaLabel="Github"
              title="Github"
            >
              <FaGithub className="h-5 w-5" />
            </Button>
            <Button variant="ghost" href={`mailto:${BUG_REPORT_EMAIL}`}>
              버그 제보
            </Button>
            <Button variant="ghost" href={SUGGESTION_URL}>
              업체 추천하기
            </Button>
            <PwaInstallButton />
            <Button
              variant="ghost"
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
