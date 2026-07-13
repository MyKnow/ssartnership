"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import FilterBar from "@/components/ui/FilterBar";
import Input from "@/components/ui/Input";
import InlineMessage from "@/components/ui/InlineMessage";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import Surface from "@/components/ui/Surface";
import AdminMemberListItem from "@/components/admin/AdminMemberListItem";
import {
  ADMIN_MEMBER_PAGE_SIZE_OPTIONS,
  type AdminMemberPageSize,
} from "@/lib/admin-ia";
import {
  type AdminMember,
  type ActivePolicyVersions,
  type ConsentFilterOption,
  type MemberFilterOption,
  type MemberSortOption,
  type NotificationPreferenceFilterOption,
  type YearFilterOption,
  normalizeAdminMembers,
} from "@/components/admin/member-manager/selectors";

export default function AdminMemberManager({
  members,
  activePolicyVersions,
  pagination,
  filters,
  options,
  state = "ready",
  errorMessage,
}: {
  members: AdminMember[];
  activePolicyVersions: ActivePolicyVersions;
  pagination: {
    totalCount: number;
    page: number;
    pageSize: AdminMemberPageSize;
  };
  filters: {
    searchValue: string;
    sortValue: MemberSortOption;
    filterValue: MemberFilterOption;
    yearFilter: YearFilterOption;
    campusFilter: string;
    serviceConsentFilter: ConsentFilterOption;
    privacyConsentFilter: ConsentFilterOption;
    marketingConsentFilter: ConsentFilterOption;
    pushEnabledFilter: NotificationPreferenceFilterOption;
    announcementEnabledFilter: NotificationPreferenceFilterOption;
    newPartnerEnabledFilter: NotificationPreferenceFilterOption;
    expiringPartnerEnabledFilter: NotificationPreferenceFilterOption;
    reviewEnabledFilter: NotificationPreferenceFilterOption;
    mmEnabledFilter: NotificationPreferenceFilterOption;
    marketingEnabledFilter: NotificationPreferenceFilterOption;
  };
  options: {
    campuses: string[];
    years: number[];
  };
  state?: "ready" | "loading" | "error" | "unauthorized" | "forbidden";
  errorMessage?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pageInputDraft, setPageInputDraft] = useState({
    sourcePage: pagination.page,
    value: String(pagination.page),
  });
  const [searchInputDraft, setSearchInputDraft] = useState({
    sourceValue: filters.searchValue,
    value: filters.searchValue,
  });

  const normalizedMembers = useMemo(
    () => normalizeAdminMembers(members, activePolicyVersions),
    [activePolicyVersions, members],
  );
  const totalPages = Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize));
  const currentPage = Math.min(pagination.page, totalPages);
  const pageStart = (currentPage - 1) * pagination.pageSize;
  const pageInputValue =
    pageInputDraft.sourcePage === pagination.page
      ? pageInputDraft.value
      : String(pagination.page);
  const searchInputValue =
    searchInputDraft.sourceValue === filters.searchValue
      ? searchInputDraft.value
      : filters.searchValue;
  const isSearchDirty = searchInputValue !== filters.searchValue;
  const hasAdvancedFilters =
    filters.sortValue !== "recent" ||
    filters.serviceConsentFilter !== "all" ||
    filters.privacyConsentFilter !== "all" ||
    filters.marketingConsentFilter !== "all" ||
    filters.pushEnabledFilter !== "all" ||
    filters.announcementEnabledFilter !== "all" ||
    filters.newPartnerEnabledFilter !== "all" ||
    filters.expiringPartnerEnabledFilter !== "all" ||
    filters.reviewEnabledFilter !== "all" ||
    filters.mmEnabledFilter !== "all" ||
    filters.marketingEnabledFilter !== "all";

  const updateQuery = (updates: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  const updateFilter = (key: string, value: string | number) => {
    setPageInputDraft({ sourcePage: pagination.page, value: "1" });
    updateQuery({ [key]: value, page: null });
  };

  const applySearchFilter = () => {
    const nextSearchValue = searchInputValue.trim();
    setSearchInputDraft({
      sourceValue: filters.searchValue,
      value: nextSearchValue,
    });

    if (nextSearchValue === filters.searchValue) {
      return;
    }

    setPageInputDraft({ sourcePage: pagination.page, value: "1" });
    updateQuery({ q: nextSearchValue, page: null });
  };

  const resetSearchFilter = () => {
    setSearchInputDraft({ sourceValue: filters.searchValue, value: "" });
    setPageInputDraft({ sourcePage: pagination.page, value: "1" });
    updateQuery({ q: null, page: null });
  };

  const syncPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);
    setPageInputDraft({ sourcePage: pagination.page, value: String(safePage) });
    updateQuery({ page: safePage });
  };

  if (state !== "ready") {
    return (
      <div className="grid min-w-0 gap-4" aria-busy={state === "loading" || undefined}>
        {state === "loading" ? (
          <>
            <Surface level="elevated" padding="lg" className="grid min-w-0 gap-4">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-full max-w-xl" />
              <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-2xl" />
                ))}
              </div>
            </Surface>
            {Array.from({ length: 4 }).map((_, index) => (
              <Surface key={index} level="inset" padding="md" className="grid min-w-0 gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:items-center">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div className="grid min-w-0 gap-2">
                  <Skeleton className="h-5 w-48 max-w-full" />
                  <Skeleton className="h-4 w-full max-w-md" />
                </div>
                <Skeleton className="h-11 w-24 rounded-2xl" />
              </Surface>
            ))}
          </>
        ) : state === "error" ? (
          <InlineMessage
            tone="danger"
            title="회원 목록을 불러오지 못했습니다."
            description={errorMessage ?? "잠시 후 다시 시도해 주세요."}
          />
        ) : (
          <Surface level="elevated" padding="lg" className="grid gap-4">
            <EmptyState
              title={
                state === "unauthorized"
                  ? "관리자 로그인이 필요합니다."
                  : "회원 목록을 볼 권한이 없습니다."
              }
              description={
                state === "unauthorized"
                  ? "관리자 계정으로 로그인한 뒤 다시 시도해 주세요."
                  : "회원 조회 권한은 최고 관리자에게 요청해 주세요."
              }
            />
            <Button
              href={
                state === "unauthorized"
                  ? "/auth/login?returnTo=%2Fadmin%2Fmembers"
                  : "/admin"
              }
              variant="secondary"
              className="justify-self-center"
            >
              {state === "unauthorized" ? "관리자 로그인" : "관리 홈으로"}
            </Button>
          </Surface>
        )}
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-6">
      <FilterBar
        title="회원 필터"
        description="자주 쓰는 검색·상태·캠퍼스·기수 필터를 먼저 확인합니다."
        tone="elevated"
      >
        <div className="grid w-full min-w-0 gap-4">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(18rem,2fr)_repeat(3,minmax(10rem,1fr))]">
            <div className="grid min-w-0 gap-1">
              <span className="ui-caption">검색</span>
              <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <Input
                  value={searchInputValue}
                  onChange={(event) => {
                    setSearchInputDraft({
                      sourceValue: filters.searchValue,
                      value: event.target.value,
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applySearchFilter();
                    }
                  }}
                  placeholder="이름, MM 아이디로 검색"
                />
                <button
                  type="button"
                  onClick={applySearchFilter}
                  disabled={!isSearchDirty || isPending}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  검색
                </button>
                {filters.searchValue ? (
                  <button
                    type="button"
                    onClick={resetSearchFilter}
                    disabled={isPending}
                    className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    초기화
                  </button>
                ) : null}
              </div>
            </div>

            <div className="grid min-w-0 gap-1">
              <span className="ui-caption">상태</span>
              <Select
                aria-label="회원 상태"
                value={filters.filterValue}
                onChange={(event) => updateFilter("status", event.target.value)}
              >
                <option value="all">전체 상태</option>
                <option value="mustChangePassword">비밀번호 변경 필요</option>
                <option value="normal">정상</option>
              </Select>
            </div>

            <div className="grid min-w-0 gap-1">
              <span className="ui-caption">캠퍼스</span>
              <Select
                aria-label="회원 캠퍼스"
                value={filters.campusFilter}
                onChange={(event) => updateFilter("campus", event.target.value)}
              >
                <option value="all">전체 캠퍼스</option>
                {options.campuses.map((campus) => (
                  <option key={campus} value={campus}>
                    {campus}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid min-w-0 gap-1">
              <span className="ui-caption">기수</span>
              <Select
                aria-label="회원 기수"
                value={filters.yearFilter}
                onChange={(event) => updateFilter("year", event.target.value)}
              >
                <option value="all">전체 기수</option>
                {options.years.map((year) => (
                  <option key={year} value={String(year)}>
                    {formatSsafyYearLabel(year)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <details
            className="group min-w-0 rounded-2xl border border-border/80 bg-surface-inset"
            open={hasAdvancedFilters || undefined}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground marker:hidden">
              <span>고급 필터</span>
              <span className="text-xs font-medium text-muted-foreground">
                정렬·약관·알림 설정 11개
              </span>
            </summary>
            <div className="grid min-w-0 gap-3 border-t border-border/70 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              <div className="grid min-w-0 gap-1">
                <span className="ui-caption">정렬</span>
                <Select aria-label="회원 정렬" value={filters.sortValue} onChange={(event) => updateFilter("sort", event.target.value)}>
                  <option value="recent">등록순</option>
                  <option value="updated">최근 수정순</option>
                  <option value="name">이름순</option>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1">
                <span className="ui-caption">서비스 이용약관</span>
                <Select aria-label="서비스 이용약관 동의 상태" value={filters.serviceConsentFilter} onChange={(event) => updateFilter("serviceConsent", event.target.value)}>
                  <option value="all">전체</option>
                  <option value="agreed">현재 동의</option>
                  <option value="pending">현재 미동의</option>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1">
                <span className="ui-caption">개인정보 처리방침</span>
                <Select aria-label="개인정보 처리방침 동의 상태" value={filters.privacyConsentFilter} onChange={(event) => updateFilter("privacyConsent", event.target.value)}>
                  <option value="all">전체</option>
                  <option value="agreed">현재 동의</option>
                  <option value="pending">현재 미동의</option>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1">
                <span className="ui-caption">마케팅 정보 수신</span>
                <Select aria-label="마케팅 정보 수신 동의 상태" value={filters.marketingConsentFilter} onChange={(event) => updateFilter("marketingConsent", event.target.value)}>
                  <option value="all">전체</option>
                  <option value="agreed">현재 동의</option>
                  <option value="pending">현재 미동의</option>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1">
                <span className="ui-caption">푸시 채널</span>
                <Select aria-label="푸시 채널 상태" value={filters.pushEnabledFilter} onChange={(event) => updateFilter("pushEnabled", event.target.value)}>
                  <option value="all">전체</option>
                  <option value="enabled">켜짐</option>
                  <option value="disabled">꺼짐</option>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1">
                <span className="ui-caption">운영 공지</span>
                <Select aria-label="운영 공지 수신 상태" value={filters.announcementEnabledFilter} onChange={(event) => updateFilter("announcementEnabled", event.target.value)}>
                  <option value="all">전체</option>
                  <option value="enabled">켜짐</option>
                  <option value="disabled">꺼짐</option>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1">
                <span className="ui-caption">신규 제휴</span>
                <Select aria-label="신규 제휴 알림 상태" value={filters.newPartnerEnabledFilter} onChange={(event) => updateFilter("newPartnerEnabled", event.target.value)}>
                  <option value="all">전체</option>
                  <option value="enabled">켜짐</option>
                  <option value="disabled">꺼짐</option>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1">
                <span className="ui-caption">종료 임박</span>
                <Select aria-label="종료 임박 알림 상태" value={filters.expiringPartnerEnabledFilter} onChange={(event) => updateFilter("expiringPartnerEnabled", event.target.value)}>
                  <option value="all">전체</option>
                  <option value="enabled">켜짐</option>
                  <option value="disabled">꺼짐</option>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1">
                <span className="ui-caption">리뷰 알림</span>
                <Select aria-label="리뷰 알림 상태" value={filters.reviewEnabledFilter} onChange={(event) => updateFilter("reviewEnabled", event.target.value)}>
                  <option value="all">전체</option>
                  <option value="enabled">켜짐</option>
                  <option value="disabled">꺼짐</option>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1">
                <span className="ui-caption">Mattermost</span>
                <Select aria-label="Mattermost 알림 상태" value={filters.mmEnabledFilter} onChange={(event) => updateFilter("mmEnabled", event.target.value)}>
                  <option value="all">전체</option>
                  <option value="enabled">켜짐</option>
                  <option value="disabled">꺼짐</option>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1">
                <span className="ui-caption">마케팅/이벤트</span>
                <Select aria-label="마케팅 이벤트 알림 상태" value={filters.marketingEnabledFilter} onChange={(event) => updateFilter("marketingEnabled", event.target.value)}>
                  <option value="all">전체</option>
                  <option value="enabled">켜짐</option>
                  <option value="disabled">꺼짐</option>
                </Select>
              </div>
            </div>
          </details>
        </div>
      </FilterBar>

      <p className="text-sm text-muted-foreground">
        조건에 맞는 회원 {pagination.totalCount.toLocaleString()}명
        {isPending ? " · 갱신 중" : ""}
      </p>

      {normalizedMembers.length === 0 ? (
        <EmptyState
          title="조건에 맞는 회원이 없습니다."
          description="검색어나 상태 필터를 조정해 다시 확인해 주세요."
        />
      ) : (
        <div className="grid min-w-0 gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-surface-muted/40 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              {pageStart + 1}-{Math.min(pageStart + normalizedMembers.length, pagination.totalCount)} /{" "}
              {pagination.totalCount}
            </p>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
              <label className="flex items-center justify-between gap-2 whitespace-nowrap sm:justify-start">
                <span>페이지당</span>
                <Select
                  value={String(pagination.pageSize)}
                  onChange={(event) => {
                    const nextPageSize = Number(event.target.value) as AdminMemberPageSize;
                    setPageInputDraft({ sourcePage: pagination.page, value: "1" });
                    updateQuery({ pageSize: nextPageSize, page: null });
                  }}
                >
                  {ADMIN_MEMBER_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}명
                    </option>
                  ))}
                </Select>
              </label>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <button
                  type="button"
                  onClick={() => syncPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이전
                </button>
                <span className="min-w-[5.5rem] text-center text-xs sm:text-sm">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => syncPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 whitespace-nowrap">
                <Input
                  type="number"
                  aria-label="이동할 회원 목록 페이지"
                  min={1}
                  max={totalPages}
                  value={pageInputValue}
                  onChange={(event) => {
                    setPageInputDraft({
                      sourcePage: pagination.page,
                      value: event.target.value,
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const parsed = Number.parseInt(pageInputValue, 10);
                      if (!Number.isNaN(parsed)) {
                        syncPage(parsed);
                      }
                    }
                  }}
                  className="w-20"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = Number.parseInt(pageInputValue, 10);
                    if (!Number.isNaN(parsed)) {
                      syncPage(parsed);
                    }
                  }}
                  className="shrink-0 whitespace-nowrap rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground"
                >
                  이동
                </button>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-3">
          {normalizedMembers.map((member) => (
            <AdminMemberListItem
              key={member.id}
              member={member}
            />
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
