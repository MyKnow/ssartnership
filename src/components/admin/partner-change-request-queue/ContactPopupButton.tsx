"use client";

import { useState } from "react";
import type { PartnerChangeRequestSummary } from "@/lib/partner-change-requests";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function ContactFieldRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href?: string;
}) {
  const { notify } = useToast();
  const normalizedValue = value?.trim() ?? "";
  const hasValue = Boolean(normalizedValue);

  return (
    <div className="rounded-2xl border border-border bg-background/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <div className="mt-2 min-w-0 break-all text-sm font-medium leading-6 text-foreground">
            {hasValue ? (
              href ? (
                <a
                  href={href}
                  className="hover:opacity-80"
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noreferrer" : undefined}
                >
                  {normalizedValue}
                </a>
              ) : (
                normalizedValue
              )
            ) : (
              <span className="text-muted-foreground">미지정</span>
            )}
          </div>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="!h-10 !w-10 !min-h-10 !min-w-10 shrink-0 sm:!h-12 sm:!w-12 sm:!min-h-12 sm:!min-w-12"
          onClick={async () => {
            if (!hasValue) {
              return;
            }

            try {
              await navigator.clipboard.writeText(normalizedValue);
              notify("복사되었습니다.");
            } catch {
              notify("복사에 실패했습니다.");
            }
          }}
          ariaLabel={`${label} 복사`}
          title={`${label} 복사`}
          disabled={!hasValue}
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
    </div>
  );
}

export function ContactPopupButton({
  request,
}: {
  request: PartnerChangeRequestSummary;
}) {
  const [open, setOpen] = useState(false);
  const contactRows: Array<{
    label: string;
    value: string | null;
    href?: string;
  }> = [
    {
      label: "담당자 이름",
      value: request.companyContactName,
    },
    {
      label: "이메일",
      value: request.companyContactEmail,
      href: request.companyContactEmail
        ? `mailto:${request.companyContactEmail}`
        : undefined,
    },
    {
      label: "전화번호",
      value: request.companyContactPhone,
      href: request.companyContactPhone
        ? `tel:${request.companyContactPhone.replace(/\s+/g, "")}`
        : undefined,
    },
  ] as const;

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        담당자 연락처
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="닫기"
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-border bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  담당자 연락처
                </p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  {request.companyName}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  복사 버튼으로 연락처를 바로 가져갈 수 있습니다.
                </p>
              </div>
              <Badge className="bg-surface-muted text-foreground">
                {request.companySlug}
              </Badge>
            </div>

            <div className="mt-5 grid gap-3">
              {contactRows.map((row) => (
                <ContactFieldRow
                  key={row.label}
                  label={row.label}
                  value={row.value}
                  href={row.href}
                />
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="primary" onClick={() => setOpen(false)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
