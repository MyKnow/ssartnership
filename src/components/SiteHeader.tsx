"use client";

import ThemeToggle from "@/components/ThemeToggle";
import Button from "@/components/ui/Button";
import Container from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";

export default function SiteHeader({
  onSuggest,
}: {
  onSuggest: () => void;
}) {
  return (
    <header className="border-b border-border bg-surface/90 backdrop-blur">
      <Container className="flex items-center justify-between gap-3 py-4">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground">
          {SITE_NAME}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onSuggest}>
            제안하기
          </Button>
          <ThemeToggle />
        </div>
      </Container>
    </header>
  );
}
