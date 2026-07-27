import Link from "next/link";
import {
  ArrowRightIcon,
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Surface from "@/components/ui/Surface";
import {
  buildAdminGlobalSearchHref,
  isAdminGlobalSearchQueryReady,
  type AdminGlobalSearchMember,
  type AdminGlobalSearchPartner,
} from "@/lib/admin-global-search";

export type { AdminGlobalSearchMember, AdminGlobalSearchPartner } from "@/lib/admin-global-search";

function buildResultHref(path: string, returnTo: string) {
  const params = new URLSearchParams({ returnTo });
  return `${path}?${params.toString()}`;
}

function getMemberTitle(member: AdminGlobalSearchMember) {
  return member.displayName ?? member.loginId ?? "이름 미입력 회원";
}

function getMemberMeta(member: AdminGlobalSearchMember) {
  const parts = [
    member.loginId ? `ID ${member.loginId}` : null,
    member.generation ? `${member.generation}기` : null,
    member.campus ?? null,
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" · ") : "추가 정보 없음";
}

function getPartnerMeta(partner: AdminGlobalSearchPartner) {
  const parts = [
    partner.location,
    partner.campusSlugs?.length ? partner.campusSlugs.join(", ") : null,
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" · ") : "위치 정보 없음";
}

function ResultLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="group flex min-h-14 min-w-0 items-center gap-3 rounded-control border border-border/70 bg-surface-inset px-3 py-3 transition-colors hover:border-strong hover:bg-surface-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-muted text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-6 text-foreground">{title}</span>
        <span className="mt-0.5 block break-words text-sm leading-5 text-muted-foreground">
          {description}
        </span>
      </span>
      <ArrowRightIcon className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function AdminGlobalSearchResultsView({
  query,
  members,
  partners,
  canSearchMembers,
  canSearchPartners,
  memberSearchFailed,
  partnerSearchFailed,
}: {
  query: string;
  members: AdminGlobalSearchMember[];
  partners: AdminGlobalSearchPartner[];
  canSearchMembers: boolean;
  canSearchPartners: boolean;
  memberSearchFailed: boolean;
  partnerSearchFailed: boolean;
}) {
  const searchHref = buildAdminGlobalSearchHref(query);
  const isQueryReady = isAdminGlobalSearchQueryReady(query);
  const canSearchAnything = canSearchMembers || canSearchPartners;
  const hasSearchFailure = memberSearchFailed || partnerSearchFailed;
  const resultCount = members.length + partners.length;

  return (
    <div className="grid min-w-0 gap-6">
      <AdminPageHeader
        eyebrow="검색"
        title="통합 검색"
        description="회원과 제휴처를 이름·로그인 ID·관리 ID로 찾아 바로 상세 화면을 엽니다. 표시되는 대상은 현재 권한과 담당 캠퍼스 범위로 제한됩니다."
      />

      <Surface level="default" padding="lg">
        <form action="/admin/search" method="get" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            <label htmlFor="admin-global-search-query" className="text-sm font-semibold text-foreground">
              찾을 대상
            </label>
            <p id="admin-global-search-query-help" className="mt-1 text-sm leading-6 text-muted-foreground">
              두 글자 이상 입력하세요. 예: 르블라썸 강남점, 홍길동, 로그인 ID, 관리 ID
            </p>
            <div className="relative mt-3">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="admin-global-search-query"
                name="q"
                type="search"
                defaultValue={query}
                minLength={2}
                maxLength={80}
                autoComplete="off"
                aria-describedby="admin-global-search-query-help"
                placeholder="이름, ID, 제휴처명을 입력하세요"
                className="pl-11"
              />
            </div>
          </div>
          <Button type="submit">검색</Button>
        </form>
      </Surface>

      {!query ? (
        <EmptyState
          title="찾을 대상의 이름이나 ID를 입력하세요."
          description="검색 결과에서 바로 상세로 이동하고, 목록 필터를 다시 설정할 필요 없이 검색 위치로 돌아올 수 있습니다."
        />
      ) : !isQueryReady ? (
        <AdminStatePanel
          kind="empty"
          title="검색어를 두 글자 이상 입력하세요."
          description="짧은 검색어는 너무 많은 결과를 만들 수 있어, 두 글자 이상부터 검색합니다."
        />
      ) : !canSearchAnything ? (
        <AdminStatePanel
          kind="forbidden"
          title="현재 권한으로 검색할 수 있는 대상이 없습니다."
          description="회원 또는 제휴처 조회 권한이 필요한 작업입니다. 권한이 필요하면 최고 권한 관리자에게 요청하세요."
        />
      ) : (
        <div className="grid min-w-0 gap-4" aria-live="polite">
          {hasSearchFailure ? (
            <AdminStatePanel
              kind="error"
              title="일부 검색 결과를 불러오지 못했습니다."
              description="잠시 후 같은 검색어로 다시 시도하세요. 이미 표시된 결과는 안전하게 열 수 있습니다."
              action={<Button href={searchHref} variant="secondary">다시 검색</Button>}
            />
          ) : null}

          {resultCount === 0 && !hasSearchFailure ? (
            <EmptyState
              title={`“${query}”와 일치하는 대상이 없습니다.`}
              description="이름의 일부, 관리 ID 또는 제휴처명을 다시 확인해 보세요."
              action={<Button href="/admin/tasks" variant="secondary">작업함 열기</Button>}
            />
          ) : null}

          {canSearchMembers && members.length > 0 ? (
            <section className="grid min-w-0 gap-3" aria-labelledby="admin-global-search-members-title">
              <div className="flex min-w-0 items-center justify-between gap-3 px-1">
                <h2 id="admin-global-search-members-title" className="text-lg font-semibold text-foreground">
                  회원
                </h2>
                <span className="text-sm text-muted-foreground">{members.length}건</span>
              </div>
              <Surface level="default" padding="sm" className="grid min-w-0 gap-2">
                {members.map((member) => (
                  <ResultLink
                    key={member.id}
                    href={buildResultHref(`/admin/members/${encodeURIComponent(member.id)}`, searchHref)}
                    icon={<UserCircleIcon className="h-5 w-5" aria-hidden="true" />}
                    title={getMemberTitle(member)}
                    description={getMemberMeta(member)}
                  />
                ))}
              </Surface>
            </section>
          ) : null}

          {canSearchPartners && partners.length > 0 ? (
            <section className="grid min-w-0 gap-3" aria-labelledby="admin-global-search-partners-title">
              <div className="flex min-w-0 items-center justify-between gap-3 px-1">
                <h2 id="admin-global-search-partners-title" className="text-lg font-semibold text-foreground">
                  제휴처
                </h2>
                <span className="text-sm text-muted-foreground">{partners.length}건</span>
              </div>
              <Surface level="default" padding="sm" className="grid min-w-0 gap-2">
                {partners.map((partner) => (
                  <ResultLink
                    key={partner.id}
                    href={buildResultHref(`/admin/partners/${encodeURIComponent(partner.id)}`, searchHref)}
                    icon={<BuildingStorefrontIcon className="h-5 w-5" aria-hidden="true" />}
                    title={partner.name}
                    description={getPartnerMeta(partner)}
                  />
                ))}
              </Surface>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
