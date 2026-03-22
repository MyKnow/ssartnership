"use client";

import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export default function ContactCopyRow({
  href,
  label,
  rawValue,
}: {
  href: string;
  label: string;
  rawValue: string;
}) {
  const { notify } = useToast();

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-muted px-4 py-3">
      <a
        href={href}
        className="text-sm font-medium text-foreground hover:opacity-80"
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
      >
        {label}
      </a>
      <Button
        size="icon"
        variant="ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(rawValue);
            notify("복사되었습니다.");
          } catch {
            notify("복사에 실패했습니다.");
          }
        }}
        ariaLabel="복사하기"
        title="복사하기"
      >
        <svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <rect x="2" y="2" width="13" height="13" rx="2" />
        </svg>
      </Button>
    </div>
  );
}
