import Link from "next/link";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import StatsRow from "@/components/ui/StatsRow";
import SubmitButton from "@/components/ui/SubmitButton";
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

export type AdminPartnerRegistrationRow = {
  id: string;
  status: string;
  source?: PartnerRegistrationSource | null;
  service_mode: "offline" | "online";
  benefit_action_type: keyof typeof ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS;
  branch_scope_type?: string | null;
  branch_scope_note?: string | null;
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
  thumbnail_url?: string | null;
  image_urls?: string[] | null;
  memo?: string | null;
  admin_note?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  company?:
    | { managed_campus_slugs?: string[] | null }
    | Array<{ managed_campus_slugs?: string[] | null }>
    | null;
  branches?: Array<{
    id: string;
    branch_type?: string | null;
    campus_slugs?: string[] | null;
  }> | null;
  benefit_groups?: Array<{
    id: string;
    group_key?: string | null;
    label?: string | null;
  }> | null;
};

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
    PARTNER_BRANCH_SCOPE_OPTIONS.find((option) => option.value === value)?.label ??
    "단일 지점"
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

export default function AdminPartnerRegistrationsView({
  rows,
  updateStatusAction,
}: {
  rows: AdminPartnerRegistrationRow[];
  updateStatusAction: AdminFormAction;
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

  return (
    <section className="grid min-w-0 gap-6">
      <AdminPageHeader
        eyebrow="Partner Registration"
        title="제휴 등록 신청 검토"
        description="공개 등록 페이지로 접수된 파트너사와 제휴처 정보를 확인하고 검토 상태를 관리합니다."
        actions={
          <>
            <Button variant="secondary" href="/partner-registration" target="_blank">
              공개 신청 페이지
            </Button>
            <Button variant="soft" href="/admin/partners/new">
              제휴처 추가
            </Button>
          </>
        }
      />
      <StatsRow
        items={[
          { label: "표시 건수", value: `${rows.length}건`, hint: "현재 필터 기준" },
          { label: "접수", value: `${counts.pending}건`, hint: "아직 검토 전" },
          { label: "검토 중", value: `${counts.in_review}건`, hint: "관리자 확인 중" },
          { label: "등록 완료", value: `${counts.converted}건`, hint: "제휴처 등록 처리" },
        ]}
        minItemWidth="12rem"
      />
      <nav className="flex min-w-0 flex-wrap gap-2" aria-label="등록 신청 상태 필터">
        <Link href="/admin/partner-registrations" className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface-control px-4 text-sm font-semibold text-foreground">
          전체
        </Link>
        {PARTNER_REGISTRATION_STATUS_OPTIONS.map((option) => (
          <Link key={option} href={`/admin/partner-registrations?status=${option}`} className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface-control px-4 text-sm font-semibold text-foreground">
            {PARTNER_REGISTRATION_STATUS_LABELS[option]}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Card tone="elevated">
          <EmptyState title="접수된 등록 신청이 없습니다" description="공개 신청 페이지에서 접수된 요청이 이곳에 표시됩니다." />
        </Card>
      ) : (
        <div className="grid min-w-0 gap-4">
          {rows.map((row) => {
            const rowStatus = normalizeStatus(row.status);
            return (
              <Card key={row.id} tone="elevated" padding="md" className="grid min-w-0 gap-5">
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(rowStatus)}>{PARTNER_REGISTRATION_STATUS_LABELS[rowStatus]}</Badge>
                      <Badge variant="neutral">{sourceLabel(row.source)}</Badge>
                      <Badge variant="primary">{branchScopeLabel(row.branch_scope_type, row.service_mode)}</Badge>
                      {!row.category_id ? <Badge variant="warning">신규 카테고리</Badge> : null}
                      <span className="text-xs font-semibold text-muted-foreground">{formatDateTime(row.created_at)}</span>
                    </div>
                    <h2 className="mt-2 truncate text-xl font-semibold text-foreground">{row.brand_name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {row.company_name} · {row.category_label} · {ADMIN_PARTNER_FILE_SERVICE_MODE_LABELS[row.service_mode]} · {ADMIN_PARTNER_FILE_BENEFIT_ACTION_LABELS[row.benefit_action_type]}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{branchSummary(row.branches)} · 혜택 그룹 {(row.benefit_groups ?? []).length || 1}개</p>
                  </div>
                  <Button variant="soft" href="/admin/partners/new">제휴처 추가로 이동</Button>
                </div>

                <div className="grid min-w-0 gap-3 lg:grid-cols-3">
                  <ValueList title="위치/링크" values={[row.location, row.map_url, row.site_link].filter((value): value is string => Boolean(value))} />
                  <ValueList title="연락처" values={[`제휴처: ${row.brand_phone || row.inquiry_link || "입력 없음"}`, `담당자: ${row.contact_name} · ${row.contact_email}`, row.contact_phone].filter((value): value is string => Boolean(value))} />
                  <ValueList title="기간/상태" values={[`${row.period_start || "미정"} ~ ${row.period_end || "미정"}`, `최근 검토: ${formatDateTime(row.reviewed_at)}`]} />
                </div>

                {row.thumbnail_url || (row.image_urls ?? []).length > 0 ? (
                  <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                    {[row.thumbnail_url, ...(row.image_urls ?? [])].filter((url): url is string => Boolean(url)).map((url, index) => (
                      <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="aspect-square min-w-0 overflow-hidden rounded-2xl border border-border bg-surface-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin review URL */}
                        <img src={url} alt={`첨부 이미지 ${index + 1}`} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}

                {row.branch_scope_note ||
                row.detail_description ||
                row.company_description ||
                row.memo ? (
                  <dl className="grid min-w-0 gap-2 rounded-2xl border border-border/70 bg-surface-inset px-4 py-3 text-sm leading-6">
                    {[
                      ["지점 범위", row.branch_scope_note],
                      ["제휴처 설명", row.detail_description],
                      ["파트너사 설명", row.company_description],
                      ["메모", row.memo],
                    ].map(([label, value]) =>
                      value ? (
                        <div key={label} className="grid min-w-0 gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
                          <dt className="font-semibold text-foreground">{label}</dt>
                          <dd className="min-w-0 break-words text-muted-foreground">{value}</dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                ) : null}

                <div className="grid min-w-0 gap-3 lg:grid-cols-3">
                  <ValueList title="혜택" values={row.benefits ?? []} />
                  <ValueList title="이용 조건" values={row.conditions ?? []} />
                  <ValueList title="태그" values={row.tags ?? []} />
                </div>

                <form action={updateStatusAction} className="grid min-w-0 gap-3 border-t border-border/70 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <input type="hidden" name="id" value={row.id} />
                  <div className="grid min-w-0 gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                    <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                      처리 상태
                      <select name="status" defaultValue={rowStatus} className="h-11 rounded-[1rem] border border-border bg-surface-control px-3 text-sm text-foreground">
                        {PARTNER_REGISTRATION_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{PARTNER_REGISTRATION_STATUS_LABELS[option]}</option>)}
                      </select>
                    </label>
                    <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
                      관리자 메모
                      <Textarea name="adminNote" defaultValue={row.admin_note ?? ""} rows={2} placeholder="검토 결과나 후속 조치 메모" />
                    </label>
                  </div>
                  <SubmitButton pendingText="저장 중" variant="secondary">상태 저장</SubmitButton>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
