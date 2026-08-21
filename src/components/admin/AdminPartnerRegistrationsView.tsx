import AdminReviewQueueHeader from "@/components/admin/AdminReviewQueueHeader";
import AdminPaginationLink from "@/components/admin/AdminPaginationLink";
import PartnerChipSections from "@/components/partner-card-form/PartnerChipSections";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
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
  PARTNER_REGISTRATION_QUEUE_SORT_OPTIONS,
  PARTNER_REGISTRATION_SOURCE_LABELS,
  PARTNER_REGISTRATION_SOURCE_OPTIONS,
  PARTNER_REGISTRATION_STATUS_LABELS,
  PARTNER_REGISTRATION_STATUS_OPTIONS,
  PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS,
  type PartnerRegistrationQueueSort,
  type PartnerRegistrationRequestStatus,
  type PartnerRegistrationSource,
} from "@/lib/partner-registration";
import {
  getPartnerVisibilityLabel,
  PARTNER_VISIBILITY_VALUES,
} from "@/lib/partner-visibility";
import type { PartnerVisibility } from "@/lib/types";
import type { AdminReviewQueueFeedback } from "@/lib/admin-review-queue";
import type { AdminPartnerRegistrationRequestDataRow } from "@/lib/admin-partner-registration-queue";
import { normalizePartnerBenefitItems } from "@/lib/partner-benefit-items";

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

function getRegistrationBenefitItems(row: AdminPartnerRegistrationRow) {
  try {
    const items = normalizePartnerBenefitItems(row.benefit_items ?? []);
    if (items.length > 0) return items;
  } catch {
    // Fall back to the legacy title list so an older request remains editable.
  }
  return normalizePartnerBenefitItems(
    (row.benefits ?? []).map((title, index) => ({
      id: `registration-benefit-${index + 1}`,
      title,
    })),
  );
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
    search,
    source,
    visibility,
    sort,
    page,
    pageSize,
  }: {
    status?: string | null;
    search?: string;
    source?: string | null;
    visibility?: string | null;
    sort?: string;
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
  if (search) {
    url.searchParams.set("q", search);
  } else {
    url.searchParams.delete("q");
  }
  if (source) {
    url.searchParams.set("source", source);
  } else {
    url.searchParams.delete("source");
  }
  if (visibility) {
    url.searchParams.set("visibility", visibility);
  } else {
    url.searchParams.delete("visibility");
  }
  if (sort && sort !== "recent") {
    url.searchParams.set("sort", sort);
  } else {
    url.searchParams.delete("sort");
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
  updateDetailsAction,
  updateStatusAction,
  search = "",
  source = null,
  visibility = null,
  sort = "recent",
  status,
  feedback,
  returnTo = "/admin/partner-registrations",
  pagination,
  loadError = false,
  canReview = true,
  canCreate = true,
  showHeader = true,
}: {
  rows: AdminPartnerRegistrationRow[];
  updateDetailsAction: AdminFormAction;
  updateStatusAction: AdminFormAction;
  search?: string;
  source?: PartnerRegistrationSource | null;
  visibility?: PartnerVisibility | null;
  sort?: PartnerRegistrationQueueSort;
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
  showHeader?: boolean;
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
        showPageHeader={showHeader}
        nextAction={{
          title: "접수 상태와 관리자 메모를 확인한 뒤 한 건씩 저장하세요.",
          description:
            "신규 카테고리나 지점 범위가 표시된 신청부터 검토하면 후속 제휴처 등록을 빠르게 이어갈 수 있습니다.",
        }}
      />
      <Surface level="default" padding="md" className="grid min-w-0 gap-4">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              신청 찾기
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              제휴처명·파트너사·카테고리·위치로 찾고, 처리 순서를 조정합니다.
            </p>
          </div>
          <Button variant="ghost" href="/admin/partner-registrations">
            조건 초기화
          </Button>
        </div>
        <form
          method="get"
          action="/admin/partner-registrations"
          className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end"
        >
          <input type="hidden" name="pageSize" value={effectivePagination.pageSize} />
          <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
            검색어
            <Input
              name="q"
              defaultValue={search}
              placeholder="제휴처명, 파트너사, 카테고리, 위치"
              maxLength={100}
            />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
            처리 상태
            <select
              name="status"
              defaultValue={status ?? ""}
              className="h-11 min-w-0 rounded-[1rem] border border-border bg-surface-control px-3 text-sm text-foreground"
            >
              <option value="">전체 상태</option>
              {PARTNER_REGISTRATION_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {PARTNER_REGISTRATION_STATUS_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
            접수 경로
            <select
              name="source"
              defaultValue={source ?? ""}
              className="h-11 min-w-0 rounded-[1rem] border border-border bg-surface-control px-3 text-sm text-foreground"
            >
              <option value="">전체 경로</option>
              {PARTNER_REGISTRATION_SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {PARTNER_REGISTRATION_SOURCE_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
            공개 상태
            <select
              name="visibility"
              defaultValue={visibility ?? ""}
              className="h-11 min-w-0 rounded-[1rem] border border-border bg-surface-control px-3 text-sm text-foreground"
            >
              <option value="">전체 공개 상태</option>
              {PARTNER_VISIBILITY_VALUES.map((option) => (
                <option key={option} value={option}>
                  {getPartnerVisibilityLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
            정렬
            <select
              name="sort"
              defaultValue={sort}
              className="h-11 min-w-0 rounded-[1rem] border border-border bg-surface-control px-3 text-sm text-foreground"
            >
              {PARTNER_REGISTRATION_QUEUE_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="primary">
            검색
          </Button>
        </form>
      </Surface>

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
                      search,
                      source,
                      visibility,
                      sort,
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
                    search,
                    source,
                    visibility,
                    sort,
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
                    search,
                    source,
                    visibility,
                    sort,
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
            const benefitItems = getRegistrationBenefitItems(row);
            const rowVisibility = PARTNER_VISIBILITY_VALUES.includes(
              row.visibility as PartnerVisibility,
            )
              ? (row.visibility as PartnerVisibility)
              : "public";
            return (
              <details className="group min-w-0 rounded-card border border-border bg-surface-elevated shadow-flat" key={row.id}>
                <summary className="flex min-w-0 cursor-pointer list-none items-start justify-between gap-4 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  <div className="flex min-w-0 flex-col gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(rowStatus)}>
                        {PARTNER_REGISTRATION_STATUS_LABELS[rowStatus]}
                      </Badge>
                      <Badge variant="neutral">{sourceLabel(row.source)}</Badge>
                      <Badge variant="neutral">
                        {getPartnerVisibilityLabel(rowVisibility)}
                      </Badge>
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
                  <span className="mt-1 shrink-0 text-sm font-semibold text-muted-foreground group-open:rotate-180" aria-hidden="true">
                   ⌄
                  </span>
                </summary>

                <div className="grid min-w-0 gap-5 border-t border-border px-5 pb-5 pt-5">
                <section className="min-w-0 rounded-2xl border border-border/70 bg-surface-inset/55">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">신청 상세 확인</h3>
                    <span className="text-right text-xs font-normal leading-5 text-muted-foreground">
                      혜택 {(row.benefits ?? []).length}개 · 조건{" "}
                      {(row.conditions ?? []).length}개 · 메모 {noteCount}개 ·
                      첨부 {attachmentCount}개
                    </span>
                  </div>
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
                </section>

                {canReview && rowStatus !== "converted" ? (
                  <section className="min-w-0 rounded-2xl border border-border/70 bg-surface-inset/55">
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <h3 className="text-sm font-semibold text-foreground">신청 정보 수정</h3>
                      <span className="text-right text-xs font-normal leading-5 text-muted-foreground">
                        지점 목록과 혜택 그룹 구조는 유지
                      </span>
                    </div>
                    <form
                      action={updateDetailsAction}
                      className="grid min-w-0 gap-4 border-t border-border/70 px-4 py-4"
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          제휴처명
                          <Input name="brandName" defaultValue={row.brand_name} />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          카테고리
                          <Input
                            name="categoryLabel"
                            defaultValue={row.category_label}
                          />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          위치
                          <Input name="location" defaultValue={row.location} />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          시작일
                          <Input
                            name="periodStart"
                            type="date"
                            defaultValue={row.period_start ?? ""}
                          />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          종료일
                          <Input
                            name="periodEnd"
                            type="date"
                            defaultValue={row.period_end ?? ""}
                          />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          사이트 링크
                          <Input name="siteLink" defaultValue={row.site_link ?? ""} />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          지도 링크
                          <Input name="mapUrl" defaultValue={row.map_url ?? ""} />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          혜택 이용 링크
                          <Input
                            name="benefitActionLink"
                            defaultValue={row.benefit_action_link ?? ""}
                          />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          혜택 이용 방식
                          <select
                            name="benefitActionType"
                            defaultValue={row.benefit_action_type}
                            className="h-11 min-w-0 rounded-[1rem] border border-border bg-surface-control px-3 text-sm text-foreground"
                          >
                            {PARTNER_REGISTRATION_BENEFIT_ACTION_OPTIONS.map(
                              (option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          제휴처 전화
                          <Input name="brandPhone" defaultValue={row.brand_phone ?? ""} />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          문의 링크 또는 연락처
                          <Input
                            name="inquiryLink"
                            defaultValue={row.inquiry_link ?? ""}
                          />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          담당자명
                          <Input name="contactName" defaultValue={row.contact_name} />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          담당자 이메일
                          <Input
                            name="contactEmail"
                            type="email"
                            defaultValue={row.contact_email}
                          />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          담당자 전화
                          <Input
                            name="contactPhone"
                            defaultValue={row.contact_phone ?? ""}
                          />
                        </label>
                      </div>
                      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          제휴처 설명
                          <Textarea
                            name="detailDescription"
                            defaultValue={row.detail_description ?? ""}
                            rows={3}
                          />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          파트너사 설명
                          <Textarea
                            name="companyDescription"
                            defaultValue={row.company_description ?? ""}
                            rows={3}
                          />
                        </label>
                        {row.service_mode !== "online" ? (
                          <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                            혜택 이용 확인 PIN
                            <Input
                              name="benefitVerificationPin"
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]{4}"
                              maxLength={4}
                              autoComplete="new-password"
                              placeholder={
                                row.benefit_verification_pin_configured
                                  ? "변경할 때만 숫자 4자리 입력"
                                  : "숫자 4자리"
                              }
                            />
                            <span className="text-xs font-normal leading-5 text-muted-foreground">
                              {row.benefit_verification_pin_configured
                                ? "비워 두면 기존 PIN을 유지합니다."
                                : "현장에서 혜택 이용을 확인할 때 사용하는 PIN입니다."}
                            </span>
                          </label>
                        ) : null}
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                          지점 범위 메모
                          <Textarea
                            name="branchScopeNote"
                            defaultValue={row.branch_scope_note ?? ""}
                            rows={3}
                          />
                        </label>
                        <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground lg:col-span-2">
                          운영 메모
                          <Textarea
                            name="memo"
                            defaultValue={row.memo ?? ""}
                            rows={3}
                          />
                        </label>
                      </div>
                      <PartnerChipSections
                        partner={{
                          id: row.id,
                          benefitActionType: row.benefit_action_type,
                          benefitItems,
                          benefits: row.benefits ?? [],
                          conditions: row.conditions ?? [],
                          tags: row.tags ?? [],
                        }}
                      />
                      <div className="flex justify-end">
                        <SubmitButton pendingText="저장 중" variant="secondary">
                          신청 정보 저장
                        </SubmitButton>
                      </div>
                    </form>
                  </section>
                ) : rowStatus === "converted" && canReview ? (
                  <Surface level="inset" className="border-t border-border/70 p-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      등록 완료된 제휴처는 제휴처 상세 화면에서 수정해 주세요.
                    </p>
                  </Surface>
                ) : null}

                {canReview ? (
                  <form
                    action={updateStatusAction}
                    className="grid min-w-0 gap-3 border-t border-border/70 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <div className="grid min-w-0 gap-3 sm:grid-cols-[12rem_12rem_minmax(0,1fr)]">
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
                        공개 상태
                        <select
                          name="visibility"
                          defaultValue={rowVisibility}
                          className="h-11 rounded-[1rem] border border-border bg-surface-control px-3 text-sm text-foreground"
                        >
                          {PARTNER_VISIBILITY_VALUES.map((option) => (
                            <option key={option} value={option}>
                              {getPartnerVisibilityLabel(option)}
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
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
