"use client";

import { FaGithub } from "react-icons/fa";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import Button from "@/components/ui/Button";

const suggestionUrl = process.env.NEXT_PUBLIC_MATTERMOST_DM_URL ?? "#";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-surface/90 py-6 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground">
            SSARTNERSHIP
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              href="https://github.com/MyKnow"
              target="_blank"
              rel="noreferrer"
              size="icon"
              ariaLabel="Github"
              title="Github"
            >
              <FaGithub className="h-5 w-5" />
            </Button>
            <Button variant="ghost" href="mailto:myknow00@naver.com">
              버그 제보
            </Button>
            <Button variant="ghost" href={suggestionUrl}>
              제휴 제안하기
            </Button>
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
          <p>Copyright © 2026 SSARTNERSHIP. All rights reserved.</p>
          <a
            href="mailto:myknow00@naver.com"
            className="font-medium text-foreground hover:opacity-80"
          >
            myknow00@naver.com
          </a>
        </div>
      </div>
    </footer>
  );
}
