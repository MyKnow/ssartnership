"use client";

import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";
import UserMenu from "@/components/auth/UserMenu";
import MobileNav from "@/components/MobileNav";

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
          className="inline-flex min-h-12 items-center text-sm font-semibold uppercase tracking-[0.24em] text-foreground hover:opacity-80"
        >
          {SITE_NAME}
        </a>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="ghost" href={suggestHref}>
              제휴 제안하기
            </Button>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <UserMenu />
          </div>
          <div className="hidden sm:flex">
            <ThemeToggle />
          </div>
          <div className="sm:hidden">
            <ThemeToggle />
          </div>
          <MobileNav suggestHref={suggestHref} />
        </div>
      </Container>
    </header>
  );
}
