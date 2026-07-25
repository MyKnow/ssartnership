"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/ui/FilterBar";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Surface from "@/components/ui/Surface";
import AdminPartnerManagerList from "@/components/admin/partner-manager/AdminPartnerManagerList";
import {
  ADMIN_PARTNER_PAGE_SIZE_OPTIONS,
  type AdminPartnerListFilters,
  type AdminPartnerPageSize,
} from "@/lib/admin-ia";
import type {
  AdminCategory,
  AdminPartner,
} from "@/components/admin/partner-manager/types";

export type { AdminCategory, AdminPartner } from "@/components/admin/partner-manager/types";

const sortOptions = [
  { value: "recent", label: "최근 등록순" },
  { value: "endingSoon", label: "종료일 임박순" },
] as const;

export default function AdminPartnerManager({
  categories,
  partners,
  pagination,
  filters,
  loadError = false,
}: {
  categories: AdminCategory[];
  partners: AdminPartner[];
  pagination: {
    totalCount: number;
    page: number;
    pageSize: AdminPartnerPageSize;
  };
  filters: AdminPartnerListFilters;
  loadError?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchInputDraft, setSearchInputDraft] = useState({
    sourceValue: filters.searchValue,
    value: filters.searchValue,
  });
  const [pageInputDraft, setPageInputDraft] = useState({
    sourcePage: pagination.page,
    value: String(pagination.page),
  });
  const [requestedPage, setRequestedPage] = useState<number | null>(null);

  const categoryOptions = useMemo(
    () => categories.map((category) => ({ key: category.key, label: category.label })),
    [categories],
  );
  const totalPages = Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize));
  const currentPage = Math.min(pagination.page, totalPages);
  const pageStart = (currentPage - 1) * pagination.pageSize;
  const isPageNavigationPending = isPending && requestedPage !== null;
  const displayedPage = isPageNavigationPending ? requestedPage : currentPage;
  const searchInputValue =
    searchInputDraft.sourceValue === filters.searchValue
      ? searchInputDraft.value
      : filters.searchValue;
  const pageInputValue =
    pageInputDraft.sourcePage === pagination.page
      ? pageInputDraft.value
      : String(currentPage);
  const isSearchDirty = searchInputValue !== filters.searchValue;
  const hasActiveFilters =
    Boolean(filters.searchValue) ||
    filters.categoryKey !== "all" ||
    filters.visibility !== "all" ||
    filters.sort !== "recent";

  const updateQuery = (
    updates: Record<string, string | number | null>,
    pendingPage: number | null = null,
  ) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    const query = next.toString();
    startTransition(() => {
      setRequestedPage(pendingPage);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  const updateFilter = (key: "category" | "visibility" | "sort", value: string) => {
    setPageInputDraft({ sourcePage: pagination.page, value: "1" });
    updateQuery({ [key]: value, page: null });
  };

  const applySearch = () => {
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

  const resetSearch = () => {
    setSearchInputDraft({ sourceValue: filters.searchValue, value: "" });
    setPageInputDraft({ sourcePage: pagination.page, value: "1" });
    updateQuery({ q: null, page: null });
  };

  const updatePage = (nextPage: number) => {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);
    if (safePage === currentPage) return;
    setPageInputDraft({ sourcePage: pagination.page, value: String(safePage) });
    updateQuery({ page: safePage }, safePage);
  };

  if (loadError) {
    return (
      <Surface level="elevated" padding="lg" className="grid min-w-0 gap-3">
        <EmptyState
          title="제휴처 목록을 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 담당자에게 알려 주세요."
        />
        <button
          type="button"
          onClick={() => router.refresh()}
          className="min-h-11 justify-self-center rounded-xl border border-border bg-surface-control px-4 text-sm font-semibold text-foreground"
        >
          다시 확인
        </button>
      </Surface>
    );
  }

  return (
    <div className="grid min-w-0 gap-4">
      <FilterBar
        title="제휴처 찾기"
        description="제휴처명을 검색한 뒤 카테고리와 노출 상태로 결과를 좁힙니다."
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
                      applySearch();
                    }
                  }}
                  placeholder="제휴처명으로 검색"
                  aria-label="제휴처명 검색"
                />
                <button
                  type="button"
                  onClick={applySearch}
                  disabled={!isSearchDirty || isPending}
                  className="min-h-11 rounded-xl border border-border bg-surface-control px-3 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  검색
                </button>
                {filters.searchValue ? (
                  <button
                    type="button"
                    onClick={resetSearch}
                    disabled={isPending}
                    className="min-h-11 rounded-xl border border-border px-3 text-sm font-medium text-muted-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    초기화
                  </button>
                ) : null}
              </div>
            </div>

            <label className="grid min-w-0 gap-1">
              <span className="ui-caption">카테고리</span>
              <Select
                aria-label="제휴처 카테고리"
                value={filters.categoryKey}
                onChange={(event) => updateFilter("category", event.target.value)}
                disabled={isPending}
              >
                <option value="all">전체 카테고리</option>
                {categoryOptions.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid min-w-0 gap-1">
              <span className="ui-caption">노출 상태</span>
              <Select
                aria-label="제휴처 노출 상태"
                value={filters.visibility}
                onChange={(event) => updateFilter("visibility", event.target.value)}
                disabled={isPending}
              >
                <option value="all">전체 상태</option>
                <option value="public">공개</option>
                <option value="confidential">대외비</option>
                <option value="private">비공개</option>
              </Select>
            </label>

            <label className="grid min-w-0 gap-1">
              <span className="ui-caption">정렬</span>
              <Select
                aria-label="제휴처 정렬"
                value={filters.sort}
                onChange={(event) => updateFilter("sort", event.target.value)}
                disabled={isPending}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>
      </FilterBar>

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" aria-live="polite">
        <p>
          조건에 맞는 제휴처 {pagination.totalCount.toLocaleString("ko-KR")}개
          {isPending ? " · 결과 갱신 중" : ""}
        </p>
        {hasActiveFilters ? <p className="text-xs">필터 적용됨</p> : null}
      </div>

      {partners.length === 0 ? (
        <EmptyState
          title="조건에 맞는 제휴처가 없습니다."
          description="검색어나 필터를 조정해 다시 확인해 주세요."
        />
      ) : (
        <div className="grid min-w-0 gap-4" aria-busy={isPageNavigationPending || undefined}>
          <Surface level="inset" padding="sm" className="flex min-w-0 flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
            <p>
              {pageStart + 1}-{Math.min(pageStart + partners.length, pagination.totalCount)} / {pagination.totalCount.toLocaleString("ko-KR")}
            </p>
            <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
              <label className="flex min-h-11 items-center justify-between gap-2 whitespace-nowrap sm:justify-start">
                <span>페이지당</span>
                <Select
                  value={String(pagination.pageSize)}
                  onChange={(event) => {
                    const nextPageSize = Number(event.target.value) as AdminPartnerPageSize;
                    setPageInputDraft({ sourcePage: pagination.page, value: "1" });
                    updateQuery({ pageSize: nextPageSize, page: null });
                  }}
                  disabled={isPending}
                >
                  {ADMIN_PARTNER_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}개</option>
                  ))}
                </Select>
              </label>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <button
                  type="button"
                  onClick={() => updatePage(currentPage - 1)}
                  disabled={currentPage === 1 || isPending}
                  className="min-h-11 min-w-14 whitespace-nowrap rounded-xl border border-border bg-surface-control px-3 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이전
                </button>
                <span className="min-w-[5.5rem] text-center text-xs sm:text-sm" aria-live="polite">
                  {isPageNavigationPending
                    ? `${displayedPage}페이지 불러오는 중`
                    : `${currentPage} / ${totalPages}`}
                </span>
                <button
                  type="button"
                  onClick={() => updatePage(currentPage + 1)}
                  disabled={currentPage === totalPages || isPending}
                  className="min-h-11 min-w-14 whitespace-nowrap rounded-xl border border-border bg-surface-control px-3 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 whitespace-nowrap">
                <Input
                  type="number"
                  aria-label="이동할 제휴처 목록 페이지"
                  min={1}
                  max={totalPages}
                  value={pageInputValue}
                  onChange={(event) => setPageInputDraft({ sourcePage: pagination.page, value: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const nextPage = Number.parseInt(pageInputValue, 10);
                      if (!Number.isNaN(nextPage)) {
                        updatePage(nextPage);
                      }
                    }
                  }}
                  className="w-20"
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextPage = Number.parseInt(pageInputValue, 10);
                    if (!Number.isNaN(nextPage)) {
                      updatePage(nextPage);
                    }
                  }}
                  disabled={isPending}
                  className="min-h-11 rounded-xl border border-border bg-surface-control px-3 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이동
                </button>
              </div>
            </div>
            <p className="sr-only" aria-live="polite">
              {isPageNavigationPending ? `${displayedPage}페이지 결과를 불러오는 중입니다.` : ""}
            </p>
          </Surface>
          <AdminPartnerManagerList partners={partners} categories={categories} />
        </div>
      )}
    </div>
  );
}
