"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import { useToast } from "@/components/ui/Toast";
import PartnerAudienceChips from "@/components/PartnerAudienceChips";
import type { PartnerChangeRequestSummary } from "@/lib/partner-change-requests";

function ListChips({
  values,
  emptyText,
  badgeClassName = "bg-surface text-foreground",
}: {
  values: string[];
  emptyText: string;
  badgeClassName?: string;
}) {
  if (values.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge key={value} className={badgeClassName}>
          {value}
        </Badge>
      ))}
    </div>
  );
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

function formatRange(start: string | null, end: string | null) {
  return `${start ?? "미정"} ~ ${end ?? "미정"}`;
}

function DiffText({
  tone,
  children,
}: {
  tone: "current" | "requested";
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "current"
          ? "break-words text-sm font-medium leading-6 text-rose-700 dark:text-rose-100"
          : "break-words text-sm font-medium leading-6 text-emerald-700 dark:text-emerald-100"
      }
    >
      {children}
    </div>
  );
}

function DiffLink({
  tone,
  href,
}: {
  tone: "current" | "requested";
  href: string | null;
}) {
  if (!href) {
    return <DiffText tone={tone}>없음</DiffText>;
  }

  return (
    <a
      className={
        tone === "current"
          ? "break-all text-sm font-medium leading-6 text-rose-700 underline decoration-rose-300 decoration-1 underline-offset-4 hover:text-rose-600 dark:text-rose-100 dark:decoration-rose-400"
          : "break-all text-sm font-medium leading-6 text-emerald-700 underline decoration-emerald-300 decoration-1 underline-offset-4 hover:text-emerald-600 dark:text-emerald-100 dark:decoration-emerald-400"
      }
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {href}
    </a>
  );
}

function DiffPanel({
  tone,
  label,
  children,
}: {
  tone: "current" | "requested";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "current"
          ? "rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4"
          : "rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4"
      }
    >
      <p
        className={
          tone === "current"
            ? "text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-200"
            : "text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200"
        }
      >
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function DiffCard({
  label,
  current,
  requested,
}: {
  label: string;
  current: React.ReactNode;
  requested: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border bg-background/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <Badge className="bg-primary/10 text-primary">변경됨</Badge>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <DiffPanel tone="current" label="현재">
          {current}
        </DiffPanel>
        <DiffPanel tone="requested" label="요청">
          {requested}
        </DiffPanel>
      </div>
    </div>
  );
}

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

function ContactPopupButton({
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

type PendingDiffItem = {
  key: string;
  label: string;
  current: React.ReactNode;
  requested: React.ReactNode;
};

function getPendingDiffItems(
  request: PartnerChangeRequestSummary,
): PendingDiffItem[] {
  const items: PendingDiffItem[] = [];

  if (request.currentPartnerName !== request.requestedPartnerName) {
    items.push({
      key: "partnerName",
      label: "브랜드명",
      current: <DiffText tone="current">{request.currentPartnerName}</DiffText>,
      requested: <DiffText tone="requested">{request.requestedPartnerName}</DiffText>,
    });
  }

  if (request.currentPartnerLocation !== request.requestedPartnerLocation) {
    items.push({
      key: "partnerLocation",
      label: "위치",
      current: <DiffText tone="current">{request.currentPartnerLocation}</DiffText>,
      requested: <DiffText tone="requested">{request.requestedPartnerLocation}</DiffText>,
    });
  }

  if (request.currentMapUrl !== request.requestedMapUrl) {
    items.push({
      key: "mapUrl",
      label: "지도 URL",
      current: <DiffLink tone="current" href={request.currentMapUrl} />,
      requested: <DiffLink tone="requested" href={request.requestedMapUrl} />,
    });
  }

  if (!arraysEqual(request.currentConditions, request.requestedConditions)) {
    items.push({
      key: "conditions",
      label: "이용 조건",
      current: (
        <ListChips
          values={request.currentConditions}
          emptyText="조건이 없습니다."
          badgeClassName="border border-rose-500/15 bg-rose-500/10 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-100"
        />
      ),
      requested: (
        <ListChips
          values={request.requestedConditions}
          emptyText="조건이 없습니다."
          badgeClassName="border border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-100"
        />
      ),
    });
  }

  if (!arraysEqual(request.currentBenefits, request.requestedBenefits)) {
    items.push({
      key: "benefits",
      label: "혜택",
      current: (
        <ListChips
          values={request.currentBenefits}
          emptyText="혜택이 없습니다."
          badgeClassName="border border-rose-500/15 bg-rose-500/10 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-100"
        />
      ),
      requested: (
        <ListChips
          values={request.requestedBenefits}
          emptyText="혜택이 없습니다."
          badgeClassName="border border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-100"
        />
      ),
    });
  }

  if (!arraysEqual(request.currentAppliesTo, request.requestedAppliesTo)) {
    items.push({
      key: "appliesTo",
      label: "적용 대상",
      current: (
        <PartnerAudienceChips
          appliesTo={request.currentAppliesTo}
          badgeClassName="border border-rose-500/15 bg-rose-500/10 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/15 dark:text-rose-100"
        />
      ),
      requested: (
        <PartnerAudienceChips
          appliesTo={request.requestedAppliesTo}
          badgeClassName="border border-emerald-500/15 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-100"
        />
      ),
    });
  }

  if (
    request.currentPeriodStart !== request.requestedPeriodStart ||
    request.currentPeriodEnd !== request.requestedPeriodEnd
  ) {
    items.push({
      key: "period",
      label: "기간",
      current: (
        <DiffText tone="current">
          {formatRange(request.currentPeriodStart, request.currentPeriodEnd)}
        </DiffText>
      ),
      requested: (
        <DiffText tone="requested">
          {formatRange(request.requestedPeriodStart, request.requestedPeriodEnd)}
        </DiffText>
      ),
    });
  }

  return items;
}

export default function PartnerChangeRequestQueue({
  requests,
  approveAction,
  rejectAction,
}: {
  requests: PartnerChangeRequestSummary[];
  approveAction: (formData: FormData) => void | Promise<void>;
  rejectAction: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card className="space-y-6">
      <SectionHeading
        title="승인 대기 요청"
        description="변경된 항목만 현재값과 요청값으로 비교한 뒤 승인하거나 거절합니다."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="승인 대기 요청이 없습니다."
          description="협력사 담당자가 민감 정보 변경 요청을 보내면 이곳에 표시됩니다."
        />
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => {
            const diffItems = getPendingDiffItems(request);

            return (
              <article
                key={request.id}
                className="space-y-4 rounded-3xl border border-border bg-surface-muted p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-amber-500/10 text-amber-700">
                        승인 대기
                      </Badge>
                      <Badge className="bg-surface text-foreground">
                        {request.companyName}
                      </Badge>
                      <Badge className="bg-surface text-foreground">
                        {request.categoryLabel}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">
                        {request.partnerName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {request.partnerLocation}
                      </p>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <p>
                      요청자{" "}
                      <span className="font-medium text-foreground">
                        {request.requestedByDisplayName ??
                          request.requestedByLoginId ??
                          "미지정"}
                      </span>
                    </p>
                    <p className="mt-1">
                      요청 시각 {new Date(request.createdAt).toLocaleString("ko-KR")}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {diffItems.map((item) => (
                    <DiffCard
                      key={item.key}
                      label={item.label}
                      current={item.current}
                      requested={item.requested}
                    />
                  ))}
                </div>

                {diffItems.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    변경된 항목이 없습니다.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <form action={approveAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <SubmitButton pendingText="승인 중">승인</SubmitButton>
                  </form>
                  <form action={rejectAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <SubmitButton variant="danger" pendingText="거절 중">
                      거절
                    </SubmitButton>
                  </form>
                  <ContactPopupButton request={request} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Card>
  );
}
