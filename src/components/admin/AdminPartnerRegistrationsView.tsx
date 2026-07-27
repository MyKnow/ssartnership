import AdminReviewQueueFilters from "@/components/admin/AdminReviewQueueFilters";
import AdminReviewQueueHeader from "@/components/admin/AdminReviewQueueHeader";
import AdminPaginationLink from "@/components/admin/AdminPaginationLink";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SubmitButton from "@/components/ui/SubmitButton";
import Surface from "@/components/ui/Surface";
import Textarea from "@/components/ui/Textarea";
import type { AdminFormAction } from "@/components/admin/admin-form-actions";
import {
  ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS,
  ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS,
} from "@/lib/admin-partner-file-import";
import { PARTNER_BRANCH_SCOPE_OPTIONS } from "@/lib/partner-branch-registration";
import {
  isPartnerRegistrationRequestStatus,
  PARTNER_REGISTRATION_SOURCE_LABELS,
  PARTNER_REGISTRATION_STATUS_LABELS,
  PARTNER_REGISTRATION_STATUS_OPTIONS,
  type PartnerRegistrationRequestStatus,
  type PartnerRegistrationSource,
} from "@/lib/partner-registration";
import type { AdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import type { AdminPartnerRegistrationRequestDataRow } from "@/lib/admin-partner-registration-queue";

export type AdminPartnerRegistrationRow =
  AdminPartnerRegistrationRequestDataRow;

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function normalizeStatus(value: string): PartnerRegistrationRequestStatus {
  return isPartnerRegistrationRequestStatus(value) ? value : "pending";
}

function statusVariant(status: PartnerRegistrationRequestStatus) {
  if (status === "converted") return "success" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "in_review") return "primary" as const;
  if (status === "archived") return "neutral" as const;
  return "warning" as const;
}

function sourceLabel(source?: string | null) {
  return source && source in PARTNER_REGISTRATION_SOURCE_LABELS
    ? PARTNER_REGISTRATION_SOURCE_LABELS[source as PartnerRegistrationSource]
    : PARTNER_REGISTRATION_SOURCE_LABELS.public_web;
}

function branchScopeLabel(value?: string | null, serviceMode?: string | null) {
  if (serviceMode === "online" || value === "online") return "온라인";
  return (
    PARTNER_BRANCH_SCOPE_OPTIONS.find((option) => option.value === value)
      ?.label ?? "단일 지점"
  );
}

function branchSummary(branches?: AdminPartnerRegistrationRow["branches"]) {
  const safeBranches = branches ?? [];
  if (safeBranches.length === 0) return "지점 목록 없음";
  const directCount = safeBranches.filter(
    (branch) => branch.branch_type === "direct",
  ).length;
  const franchiseCount = safeBranches.filter(
    (branch) => branch.branch_type === "franchise",
  ).length;
  return [
    `${safeBranches.length.toLocaleString("ko-KR")}개 지점`,
    directCount > 0 ? `직영 ${directCount.toLocaleString("ko-KR")}` : null,
    franchiseCount > 0
      ? `가맹 ${franchiseCount.toLocaleString("ko-KR")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function ValueList({ title, values }: { title: string; values: string[] }) {
  return (
    <Surface level="inset" padding="sm" className="min-w-0">
      <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </p>
      {values.length > 0 ? (
        <ul className="mt-2 grid gap-1 text-sm leading-6 text-foreground">
          {values.map((value) => (
            <li key={value} className="min-w-0 break-words">
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">입력 없음</p>
      )}
    </Surface>
  );
}

function buildRegistrationQueueHref(
  returnTo: string,
  {
    status,
    page,
    pageSize,
  }: {
    status?: string | null;
    page: number;
    pageSize: number;
  },
) {
  const url = new URL(returnTo, "https://admin.local");
  if (status) {
    url.searchParams.set("status", status);
  } else {
    url.searchParams.delete("status");
  }
  if (page > 1) {
    url.searchParams.set("page", String(page));
  } else {
    url.searchParams.delete("page");
  }
  if (pageSize !== 12) {
    url.searchParams.set("pageSize", String(pageSize));
  } else {
    url.searchParams.delete("pageSize");
  }
  return `${url.pathname}${url.search}`;
}

export default function AdminPartnerRegistrationsView({
  rows,
  updateStatusAction,
  status,
  feedback,
  returnTo = "/admin/partner-registrations",
  pagination,
  loadError = false,
  canReview = true,
  canCreate = true,
}: {
  rows: AdminPartnerRegistrationRow[];
  updateStatusAction: AdminFormAction;
  status?: PartnerRegistrationRequestStatus | null;
  feedback?: AdminReviewQueueFeedback | null;
  returnTo?: string;
  pagination?: {
    totalCount: number;
    page: number;
    pageSize: number;
  };
  loadError?: boolean;
  canReview?: boolean;
  canCreate?: boolean;
}) {
  const counts = rows.reduce(
    (result, row) => ({
      ...result,
      [normalizeStatus(row.status)]: result[normalizeStatus(row.status)] + 1,
    }),
    {
      pending: 0,
      in_review: 0,
      converted: 0,
      rejected: 0,
      archived: 0,
    } satisfies Record<PartnerRegistrationRequestStatus, number>,
  );
  const effectivePagination = pagination ?? {
    totalCount: rows.length,
    page: 1,
    pageSize: Math.max(1, rows.length),
  };
  const totalPages = Math.max(
    1,
    Math.ceil(effectivePagination.totalCount / effectivePagination.pageSize),
  );
  const currentPage = Math.min(effectivePagination.page, totalPages);
  const pageStart = (currentPage - 1) * effectivePagination.pageSize;

  return (
    <section className="grid min-w-0 gap-6">
      <AdminReviewQueueHeader
        eyebrow="등록 신청"
        title="제휴 등록 신청 검토"
        description="공개 등록 페이지로 접수된 파트너사와 제휴처 정보를 확인하고 검토 상태를 관리합니다."
        actions={
          <>
            <Button
              variant="secondary"
              href="/partner-registration"
              target="_blank"
            >
              공개 신청 페이지
            </Button>
            {canCreate ? (
              <Button variant="soft" href="/admin/partners/new">
                제휴처 추가
              </Button>
            ) : null}
          </>
        }
        metrics={[
          {
            label: "조건 일치",
            value: `${effectivePagination.totalCount.toLocaleString("ko-KR")}건`,
            hint: "현재 상태와 권한 범위",
          },
          {
            label: "현재 표시",
            value: `${rows.length.toLocaleString("ko-KR")}건`,
            hint: `${currentPage} / ${totalPages} 페이지`,
          },
          {
            label: "접수",
            value: `${counts.pending}건`,
            hint: "현재 페이지에서 아직 검토 전",
          },
          {
            label: "검토 중",
            value: `${counts.in_review}건`,
            hint: "현재 페이지에서 관리자 확인 중",
          },
        ]}
        feedback={feedback}
        nextAction={{
          title: "접수 상태와 관리자 메모를 확인한 뒤 한 건씩 저장하세요.",
          description:
            "신규 카테고리나 지점 범위가 표시된 신청부터 검토하면 후속 제휴처 등록을 빠르게 이어갈 수 있습니다.",
        }}
      />
      <AdminReviewQueueFilters
        options={PARTNER_REGISTRATION_STATUS_OPTIONS.map((option) => ({
          value: option,
          label: PARTNER_REGISTRATION_STATUS_LABELS[option],
        }))}
        value={status}
        getHref={(nextStatus) =>
          buildRegistrationQueueHref(returnTo, {
            status: nextStatus,
            page: 1,
            pageSize: effectivePagination.pageSize,
          })
        }
        ariaLabel="등록 신청 상태 필터"
      />

      {loadError ? (
        <AdminStatePanel
          kind="error"
          title="등록 신청을 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요."
          action={
            <Button variant="secondary" href={returnTo}>
              다시 확인
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <AdminStatePanel
          kind="empty"
          title="접수된 등록 신청이 없습니다"
          description="현재 조건에 맞는 요청이 없습니다. 상태 필터를 바꾸거나 공개 신청 페이지를 확인해 주세요."
          action={
            <Button
              variant="secondary"
              href="/partner-registration"
              target="_blank"
            >
              공개 신청 페이지
            </Button>
          }
        />
      ) : (
        <div className="grid min-w-0 gap-4">
          {totalPages > 1 ? (
            <Surface
              level="inset"
              padding="sm"
              className="grid min-w-0 gap-3 text-sm text-muted-foreground lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center"
            >
              <p>
                {pageStart + 1}-
                {Math.min(
                  pageStart + rows.length,
                  effectivePagination.totalCount,
                )}{" "}
                / {effectivePagination.totalCount.toLocaleString("ko-KR")}
              </p>
              <div
                className="flex flex-wrap gap-1.5"
                aria-label="페이지당 표시 건수"
              >
                {[6, 12, 24].map((pageSize) => (
                  <AdminPaginationLink
                    key={pageSize}
                    href={buildRegistrationQueueHref(returnTo, {
                      status,
                      page: 1,
                      pageSize,
                    })}
                    variant={
                      pageSize === effectivePagination.pageSize
                        ? "secondary"
                        : "ghost"
                    }
                  >
                    {pageSize}개씩
                  </AdminPaginationLink>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <AdminPaginationLink
                  href={buildRegistrationQueueHref(returnTo, {
                    status,
                    page: currentPage - 1,
                    pageSize: effectivePagination.pageSize,
                  })}
                  prefetch
                  disabled={currentPage === 1}
                >
                  이전
                </AdminPaginationLink>
                <span className="min-w-[5.5rem] text-center text-xs sm:text-sm">
                  {currentPage} / {totalPages}
                </span>
                <AdminPaginationLink
                  href={buildRegistrationQueueHref(returnTo, {
                    status,
                    page: currentPage + 1,
                    pageSize: effectivePagination.pageSize,
                  })}
                  prefetch
                  disabled={currentPage === totalPages}
                >
                  다음
                </AdminPaginationLink>
              </div>
            </Surface>
          ) : null}
          {rows.map((row) => {
            const rowStatus = normalizeStatus(row.status);
            const attachmentCount = [
              row.thumbnail_url,
              ...(row.image_urls ?? []),
            ].filter(Boolean).length;
            const noteCount = [
              row.branch_scope_note,
              row.detail_description,
              row.company_description,
              row.memo,
            ].filter(Boolean).length;
            return (
              <Card
                key={row.id}
                tone="elevated"
                padding="md"
                className="grid min-w-0 gap-5"
              >
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(rowStatus)}>
                        {PARTNER_REGISTRATION_STATUS_LABELS[rowStatus]}
                      </Badge>
                      <Badge variant="neutral">{sourceLabel(row.source)}</Badge>
                      <Badge variant="primary">
                        {branchScopeLabel(
                          row.branch_scope_type,
                          row.service_mode,
                        )}
                      </Badge>
                      {!row.category_id ? (
                        <Badge variant="warning">신규 카테고리</Badge>
                      ) : null}
                      <span className="text-xs font-semibold text-muted-foreground">
                        {formatDateTime(row.created_at)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-foreground">
                      {row.brand_name}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {row.company_name} · {row.category_label} ·{" "}
                      {ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS[row.service_mode]}{" "}
                      ·{" "}
                      {
                        ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS[
                          row.benefit_action_type
                        ]
                      }
                    </p>
                    <p className="mt-2 break-words text-sm text-foreground">
                      {row.location}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {branchSummary(row.branches)} · 혜택 그룹{" "}
                      {(row.benefit_groups ?? []).length || 1}개
                    </p>
                  </div>
                </div>

                <details className="group min-w-0 rounded-2xl border border-border/70 bg-surface-inset/55">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                    <span>신청 상세 확인</span>
                    <span className="text-right text-xs font-normal leading-5 text-muted-foreground">
                      혜택 {(row.benefits ?? []).length}개 · 조건{" "}
                      {(row.conditions ?? []).length}개 · 메모 {noteCount}개 ·
                      첨부 {attachmentCount}개
                    </span>
                  </summary>
                  <div className="grid min-w-0 gap-4 border-t border-border/70 px-4 py-4">
                    <div className="grid min-w-0 gap-3 lg:grid-cols-3">
                      <ValueList
                        title="링크"
                        values={[row.map_url, row.site_link].filter(
                          (value): value is string => Boolean(value),
                        )}
                      />
                      <ValueList
                        title="연락처"
                        values={[
                          `제휴처: ${row.brand_phone || row.inquiry_link || "입력 없음"}`,
                          `담당자: ${row.contact_name} · ${row.contact_email}`,
                          row.contact_phone,
                        ].filter((value): value is string => Boolean(value))}
                      />
                      <ValueList
                        title="기간/상태"
                        values={[
                          `${row.period_start || "미정"} ~ ${row.period_end || "미정"}`,
                          `최근 검토: ${formatDateTime(row.reviewed_at)}`,
                        ]}
                      />
                    </div>

                    {attachmentCount > 0 ? (
                      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                        {[row.thumbnail_url, ...(row.image_urls ?? [])]
                          .filter((url): url is string => Boolean(url))
                          .map((url, index) => (
                            <a
                              key={`${url}-${index}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="aspect-square min-w-0 overflow-hidden rounded-2xl border border-border bg-surface-muted"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin review URL */}
                              <img
                                src={url}
                                alt={`첨부 이미지 ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </a>
                          ))}
                      </div>
                    ) : null}

                    {noteCount > 0 ? (
                      <dl className="grid min-w-0 gap-2 rounded-2xl border border-border/70 bg-surface-inset px-4 py-3 text-sm leading-6">
                        {[
                          ["지점 범위", row.branch_scope_note],
                          ["제휴처 설명", row.detail_description],
                          ["파트너사 설명", row.company_description],
                          ["메모", row.memo],
                        ].map(([label, value]) =>
                          value ? (
                            <div
                              key={label}
                              className="grid min-w-0 gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]"
                            >
                              <dt className="font-semibold text-foreground">
                                {label}
                              </dt>
                              <dd className="min-w-0 break-words text-muted-foreground">
                                {value}
                              </dd>
                            </div>
                          ) : null,
                        )}
                      </dl>
                    ) : null}

                    <div className="grid min-w-0 gap-3 lg:grid-cols-3">
                      <ValueList title="혜택" values={row.benefits ?? []} />
                      <ValueList
                        title="이용 조건"
                        values={row.conditions ?? []}
                      />
                      <ValueList title="태그" values={row.tags ?? []} />
                    </div>
                  </div>
                </details>

                {canReview ? (
                  <form
                    action={updateStatusAction}
                    className="grid min-w-0 gap-3 border-t border-border/70 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <div className="grid min-w-0 gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                      <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                        처리 상태
                        <select
                          name="status"
                          defaultValue={rowStatus}
                          className="h-11 rounded-[1rem] border border-border bg-surface-control px-3 text-sm text-foreground"
                        >
                          {PARTNER_REGISTRATION_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {PARTNER_REGISTRATION_STATUS_LABELS[option]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                        관리자 메모
                        <Textarea
                          name="adminNote"
                          defaultValue={row.admin_note ?? ""}
                          rows={2}
                          placeholder="검토 결과나 후속 조치 메모"
                        />
                      </label>
                    </div>
                    <SubmitButton pendingText="저장 중" variant="secondary">
                      상태 저장
                    </SubmitButton>
                  </form>
                ) : (
                  <Surface
                    level="inset"
                    className="border-t border-border/70 p-4"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      조회 전용 권한
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      신청 상세와 현재 상태는 확인할 수 있지만, 상태 변경은 제휴
                      운영 권한이 있는 관리자만 할 수 있습니다.
                    </p>
                  </Surface>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
