"use client";

import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";

export default function SiteHeader({
  suggestHref = "/suggest",
}: {
  suggestHref?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
      <Container className="flex items-center justify-between gap-3 py-4">
        <a
          href="/"
          className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground hover:opacity-80"
        >
          {SITE_NAME}
        </a>
        <div className="flex items-center gap-2">
          <Button variant="ghost" href={suggestHref}>
            제휴 제안하기
          </Button>
          <ThemeToggle />
        </div>
      </Container>
    </header>
  );
}
