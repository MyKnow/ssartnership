import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ShellHeader from "@/components/ui/ShellHeader";
import StatsRow from "@/components/ui/StatsRow";
import SubmitButton from "@/components/ui/SubmitButton";
import Textarea from "@/components/ui/Textarea";
import { updatePartnerRegistrationRequestStatus } from "@/app/admin/(protected)/partner-registrations/actions";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  canAdminAccessManagedCampuses,
  getManagedCampusFilterValues,
} from "@/lib/admin-scope";
import {
  ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS,
  ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS,
} from "@/lib/admin-partner-file-import";
import { inferCampusSlugsFromLocation } from "@/lib/campuses";
import {
  isPartnerRegistrationRequestStatus,
  PARTNER_REGISTRATION_SOURCE_LABELS,
  PARTNER_REGISTRATION_STATUS_LABELS,
  PARTNER_REGISTRATION_STATUS_OPTIONS,
  type PartnerRegistrationRequestStatus,
  type PartnerRegistrationSource,
} from "@/lib/partner-registration";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RegistrationRow = {
  id: string;
  status: string;
  source?: PartnerRegistrationSource | null;
  company_id?: string | null;
  requested_by_partner_account_id?: string | null;
  service_mode: "offline" | "online";
  benefit_action_type: keyof typeof ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS;
  brand_name: string;
  category_id?: string | null;
  category_label: string;
  period_start?: string | null;
  period_end?: string | null;
  inquiry_link?: string | null;
  brand_phone?: string | null;
  detail_description?: string | null;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone?: string | null;
  company_description?: string | null;
  benefits: string[];
  conditions: string[];
  tags: string[];
  location: string;
  map_url?: string | null;
  site_link?: string | null;
  benefit_action_link?: string | null;
  thumbnail_url?: string | null;
  image_urls?: string[] | null;
  memo?: string | null;
  admin_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  company?: { managed_campus_slugs?: string[] | null } | { managed_campus_slugs?: string[] | null }[] | null;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatPeriod(start?: string | null, end?: string | null) {
  if (!start && !end) {
    return "기간 미정";
  }
  return `${start || "미정"} ~ ${end || "미정"}`;
}

function normalizeStatus(value: string): PartnerRegistrationRequestStatus {
  return isPartnerRegistrationRequestStatus(value) ? value : "pending";
}

function getStatusBadgeVariant(status: PartnerRegistrationRequestStatus) {
  if (status === "converted") {
    return "success" as const;
  }
  if (status === "rejected") {
    return "danger" as const;
  }
  if (status === "in_review") {
    return "primary" as const;
  }
  if (status === "archived") {
    return "neutral" as const;
  }
  return "warning" as const;
}

function getSourceLabel(source?: string | null) {
  if (source && source in PARTNER_REGISTRATION_SOURCE_LABELS) {
    return PARTNER_REGISTRATION_SOURCE_LABELS[source as PartnerRegistrationSource];
  }
  return PARTNER_REGISTRATION_SOURCE_LABELS.public_web;
}

function ValueList({
  title,
  values,
}: {
  title: string;
  values: string[];
}) {
  return (
    <div className="min-w-0 rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
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
    </div>
  );
}

export default async function AdminPartnerRegistrationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const adminSession = await requireAdminPermission("brands", "read", {
    path: "/admin/partner-registrations",
  });
  const managedCampusFilter = getManagedCampusFilterValues(adminSession.account);

  const params = (await searchParams) ?? {};
  const statusFilter = params.status;
  const status =
    statusFilter && isPartnerRegistrationRequestStatus(statusFilter)
      ? statusFilter
      : null;

  let query = getSupabaseAdminClient()
    .from("partner_registration_requests")
    .select("*,company:partner_companies(managed_campus_slugs)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`partner registration request load failed: ${error.message}`);
  }

  const rows = ((data ?? []) as RegistrationRow[]).filter((row) => {
    if (!managedCampusFilter) {
      return true;
    }
    const company = Array.isArray(row.company) ? row.company[0] : row.company;
    const managedCampusSlugs =
      company?.managed_campus_slugs ?? inferCampusSlugsFromLocation(row.location);
    return canAdminAccessManagedCampuses(
      adminSession.account,
      managedCampusSlugs,
    );
  });
  const counts = rows.reduce(
    (acc, row) => {
      const rowStatus = normalizeStatus(row.status);
      acc[rowStatus] += 1;
      return acc;
    },
    {
      pending: 0,
      in_review: 0,
      converted: 0,
      rejected: 0,
      archived: 0,
    } satisfies Record<PartnerRegistrationRequestStatus, number>,
  );

  return (
    <AdminShell
      title="제휴 등록 신청"
      backHref="/admin/partners"
      backLabel="제휴처/브랜드"
    >
      <section className="grid min-w-0 gap-6">
        <ShellHeader
          eyebrow="Partner Registration"
          title="제휴 등록 신청 검토"
          description="공개 등록 페이지로 접수된 업체/브랜드 정보를 확인하고, 검토 상태를 관리합니다."
          actions={
            <>
              <Button variant="secondary" href="/partner-registration" target="_blank">
                공개 신청 페이지
              </Button>
              <Button variant="soft" href="/admin/partners/new">
                브랜드 추가
              </Button>
            </>
          }
        />

        <StatsRow
          items={[
            { label: "표시 건수", value: `${rows.length.toLocaleString()}건`, hint: "현재 필터 기준" },
            { label: "접수", value: `${counts.pending.toLocaleString()}건`, hint: "아직 검토 전" },
            { label: "검토 중", value: `${counts.in_review.toLocaleString()}건`, hint: "관리자 확인 중" },
            { label: "등록 완료", value: `${counts.converted.toLocaleString()}건`, hint: "브랜드 등록 처리" },
          ]}
          minItemWidth="12rem"
        />

        <nav className="flex min-w-0 flex-wrap gap-2" aria-label="등록 신청 상태 필터">
          <Link
            href="/admin/partner-registrations"
            className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface-control px-4 text-sm font-semibold text-foreground transition-interactive hover:-translate-y-px hover:border-strong"
          >
            전체
          </Link>
          {PARTNER_REGISTRATION_STATUS_OPTIONS.map((option) => (
            <Link
              key={option}
              href={`/admin/partner-registrations?status=${option}`}
              className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface-control px-4 text-sm font-semibold text-foreground transition-interactive hover:-translate-y-px hover:border-strong"
            >
              {PARTNER_REGISTRATION_STATUS_LABELS[option]}
            </Link>
          ))}
        </nav>

        {rows.length === 0 ? (
          <Card tone="elevated">
            <EmptyState
              title="접수된 등록 신청이 없습니다"
              description="공개 신청 페이지 링크를 Notion 안내서에 연결하면 신청자가 직접 접수할 수 있습니다."
            />
          </Card>
        ) : (
          <div className="grid min-w-0 gap-4">
            {rows.map((row) => {
              const rowStatus = normalizeStatus(row.status);
              const serviceLabel =
                ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS[row.service_mode];
              const actionLabel =
                ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS[row.benefit_action_type];
              return (
                <Card key={row.id} tone="elevated" padding="md" className="grid gap-5">
                  <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(rowStatus)}>
                          {PARTNER_REGISTRATION_STATUS_LABELS[rowStatus]}
                        </Badge>
                        <Badge variant="neutral">{getSourceLabel(row.source)}</Badge>
                        {!row.category_id ? (
                          <Badge variant="warning">신규 카테고리</Badge>
                        ) : null}
                        <span className="text-xs font-semibold text-muted-foreground">
                          {formatDateTime(row.created_at)}
                        </span>
                      </div>
                      <h2 className="mt-2 truncate text-xl font-semibold text-foreground">
                        {row.brand_name}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {row.company_name} · {row.category_label} · {serviceLabel} ·{" "}
                        {actionLabel}
                      </p>
                    </div>
                    <Button variant="soft" href="/admin/partners/new" className="w-full sm:w-auto">
                      브랜드 추가로 이동
                    </Button>
                  </div>

                  <div className="grid min-w-0 gap-3 lg:grid-cols-3">
                    <div className="min-w-0 rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
                      <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        위치/링크
                      </p>
                      <div className="mt-2 grid gap-1 text-sm leading-6 text-foreground">
                        <p className="min-w-0 break-words">{row.location}</p>
                        {row.map_url ? (
                          <p className="min-w-0 break-all text-muted-foreground">
                            {row.map_url}
                          </p>
                        ) : null}
                        {row.site_link ? (
                          <p className="min-w-0 break-all text-muted-foreground">
                            {row.site_link}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
                      <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        연락처
                      </p>
                      <div className="mt-2 grid gap-1 text-sm leading-6 text-foreground">
                        <p className="min-w-0 break-words">
                          브랜드: {row.brand_phone || row.inquiry_link || "입력 없음"}
                        </p>
                        <p className="min-w-0 break-words">
                          담당자: {row.contact_name} · {row.contact_email}
                        </p>
                        {row.contact_phone ? (
                          <p className="min-w-0 break-words">{row.contact_phone}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="min-w-0 rounded-[1rem] border border-border/70 bg-surface-inset px-4 py-3">
                      <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        기간/상태
                      </p>
                      <div className="mt-2 grid gap-1 text-sm leading-6 text-foreground">
                        <p className="min-w-0 break-words">
                          {formatPeriod(row.period_start, row.period_end)}
                        </p>
                        <p className="min-w-0 break-words">
                          최근 검토: {formatDateTime(row.reviewed_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {row.thumbnail_url || (row.image_urls ?? []).length > 0 ? (
                    <div className="grid min-w-0 gap-3 rounded-[1rem] border border-border/70 bg-surface-inset p-3">
                      <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        첨부 이미지
                      </p>
                      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        {[row.thumbnail_url, ...(row.image_urls ?? [])]
                          .filter((url): url is string => Boolean(url))
                          .map((url, index) => (
                            <a
                              key={`${url}-${index}`}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative aspect-square min-w-0 overflow-hidden rounded-[0.85rem] border border-border bg-surface-muted"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- admin review needs arbitrary storage URL preview */}
                              <img
                                src={url}
                                alt={`첨부 이미지 ${index + 1}`}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                              <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[11px] font-semibold text-white">
                                {index === 0 && row.thumbnail_url ? "대표" : index + 1}
                              </span>
                            </a>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  {row.detail_description || row.company_description || row.memo ? (
                    <div className="grid min-w-0 gap-3 text-sm leading-6 text-muted-foreground">
                      {row.detail_description ? (
                        <p className="min-w-0 break-words">
                          <strong className="text-foreground">브랜드 설명</strong>{" "}
                          {row.detail_description}
                        </p>
                      ) : null}
                      {row.company_description ? (
                        <p className="min-w-0 break-words">
                          <strong className="text-foreground">협력사 설명</strong>{" "}
                          {row.company_description}
                        </p>
                      ) : null}
                      {row.memo ? (
                        <p className="min-w-0 break-words">
                          <strong className="text-foreground">메모</strong> {row.memo}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid min-w-0 gap-3 lg:grid-cols-3">
                    <ValueList title="혜택" values={row.benefits ?? []} />
                    <ValueList title="이용 조건" values={row.conditions ?? []} />
                    <ValueList title="태그" values={row.tags ?? []} />
                  </div>

                  <form
                    action={updatePartnerRegistrationRequestStatus}
                    className="grid min-w-0 gap-3 border-t border-border/70 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end"
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <div className="grid min-w-0 gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                      <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                        처리 상태
                        <select
                          name="status"
                          defaultValue={rowStatus}
                          className="h-11 rounded-[1rem] border border-border bg-surface-control px-3 text-sm text-foreground shadow-flat focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
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
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
