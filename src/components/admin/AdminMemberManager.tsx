"use client";

import { useMemo, useState } from "react";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/ui/FilterBar";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import AdminMemberListItem from "@/components/admin/AdminMemberListItem";
import {
  type AdminMember,
  type ActivePolicyVersions,
  type ConsentFilterOption,
  type MemberFilterOption,
  type MemberSortOption,
  type NotificationPreferenceFilterOption,
  type YearFilterOption,
  filterAdminMembers,
  getAdminMemberCampusOptions,
  getAdminMemberYearOptions,
  normalizeAdminMembers,
} from "@/components/admin/member-manager/selectors";

const MEMBER_PAGE_SIZE_OPTIONS = [10, 50, 100, 500] as const;

export default function AdminMemberManager({
  members,
  activePolicyVersions,
  updateMember,
  deleteMember,
}: {
  members: AdminMember[];
  activePolicyVersions: ActivePolicyVersions;
  updateMember: (formData: FormData) => void | Promise<void>;
  deleteMember: (formData: FormData) => void | Promise<void>;
}) {
  const [searchValue, setSearchValue] = useState("");
  const [sortValue, setSortValue] = useState<MemberSortOption>("recent");
  const [filterValue, setFilterValue] = useState<MemberFilterOption>("all");
  const [yearFilter, setYearFilter] = useState<YearFilterOption>("all");
  const [campusFilter, setCampusFilter] = useState("all");
  const [serviceConsentFilter, setServiceConsentFilter] =
    useState<ConsentFilterOption>("all");
  const [privacyConsentFilter, setPrivacyConsentFilter] =
    useState<ConsentFilterOption>("all");
  const [marketingConsentFilter, setMarketingConsentFilter] =
    useState<ConsentFilterOption>("all");
  const [pushEnabledFilter, setPushEnabledFilter] =
    useState<NotificationPreferenceFilterOption>("all");
  const [announcementEnabledFilter, setAnnouncementEnabledFilter] =
    useState<NotificationPreferenceFilterOption>("all");
  const [newPartnerEnabledFilter, setNewPartnerEnabledFilter] =
    useState<NotificationPreferenceFilterOption>("all");
  const [expiringPartnerEnabledFilter, setExpiringPartnerEnabledFilter] =
    useState<NotificationPreferenceFilterOption>("all");
  const [reviewEnabledFilter, setReviewEnabledFilter] =
    useState<NotificationPreferenceFilterOption>("all");
  const [mmEnabledFilter, setMmEnabledFilter] =
    useState<NotificationPreferenceFilterOption>("all");
  const [marketingEnabledFilter, setMarketingEnabledFilter] =
    useState<NotificationPreferenceFilterOption>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof MEMBER_PAGE_SIZE_OPTIONS)[number]>(50);
  const [pageInputValue, setPageInputValue] = useState("1");
  const resetPage = () => setPage(1);

  const normalizedMembers = useMemo(
    () => normalizeAdminMembers(members, activePolicyVersions),
    [activePolicyVersions, members],
  );
  const campusOptions = useMemo(
    () => getAdminMemberCampusOptions(normalizedMembers),
    [normalizedMembers],
  );
  const yearOptions = useMemo(
    () => getAdminMemberYearOptions(normalizedMembers),
    [normalizedMembers],
  );

  const filteredMembers = useMemo(() => {
    return filterAdminMembers({
      members: normalizedMembers,
      searchValue,
      sortValue,
      filterValue,
      yearFilter,
      campusFilter,
      serviceConsentFilter,
      privacyConsentFilter,
      marketingConsentFilter,
      pushEnabledFilter,
      announcementEnabledFilter,
      newPartnerEnabledFilter,
      expiringPartnerEnabledFilter,
      reviewEnabledFilter,
      mmEnabledFilter,
      marketingEnabledFilter,
    });
  }, [
    announcementEnabledFilter,
    campusFilter,
    filterValue,
    expiringPartnerEnabledFilter,
    marketingConsentFilter,
    marketingEnabledFilter,
    mmEnabledFilter,
    newPartnerEnabledFilter,
    normalizedMembers,
    privacyConsentFilter,
    pushEnabledFilter,
    reviewEnabledFilter,
    searchValue,
    serviceConsentFilter,
    sortValue,
    yearFilter,
  ]);
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleMembers = useMemo(
    () => filteredMembers.slice(pageStart, pageStart + pageSize),
    [filteredMembers, pageSize, pageStart],
  );

  const syncPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);
    setPage(safePage);
    setPageInputValue(String(safePage));
  };

  return (
    <div className="mt-6 grid min-w-0 gap-6">
      <FilterBar
        title="회원 필터"
        description="이름, 기수, 캠퍼스, 현재 활성 버전 기준 약관 상태로 회원 목록을 빠르게 좁힙니다."
      >
        <div className="grid min-w-[14rem] flex-1 gap-1">
          <span className="ui-caption">검색</span>
          <Input
            value={searchValue}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setSearchValue(event.target.value);
            }}
            placeholder="이름, MM 아이디로 검색"
          />
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">기수</span>
          <Select
            value={yearFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setYearFilter(event.target.value as YearFilterOption);
            }}
          >
            <option value="all">전체 기수</option>
            {yearOptions.map((year) => (
              <option key={year} value={String(year)}>
                {formatSsafyYearLabel(year)}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">정렬</span>
          <Select
            value={sortValue}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setSortValue(event.target.value as MemberSortOption);
            }}
          >
            <option value="recent">등록순</option>
            <option value="updated">최근 수정순</option>
            <option value="name">이름순</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">상태</span>
          <Select
            value={filterValue}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setFilterValue(event.target.value as MemberFilterOption);
            }}
          >
            <option value="all">전체 상태</option>
            <option value="mustChangePassword">비밀번호 변경 필요</option>
            <option value="normal">정상</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">캠퍼스</span>
          <Select
            value={campusFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setCampusFilter(event.target.value);
            }}
          >
            <option value="all">전체 캠퍼스</option>
            {campusOptions.map((campus) => (
              <option key={campus} value={campus}>
                {campus}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">서비스 이용약관</span>
          <Select
            value={serviceConsentFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setServiceConsentFilter(event.target.value as ConsentFilterOption);
            }}
          >
            <option value="all">전체</option>
            <option value="agreed">현재 동의</option>
            <option value="pending">현재 미동의</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">개인정보 처리방침</span>
          <Select
            value={privacyConsentFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setPrivacyConsentFilter(event.target.value as ConsentFilterOption);
            }}
          >
            <option value="all">전체</option>
            <option value="agreed">현재 동의</option>
            <option value="pending">현재 미동의</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">마케팅 정보 수신</span>
          <Select
            value={marketingConsentFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setMarketingConsentFilter(event.target.value as ConsentFilterOption);
            }}
          >
            <option value="all">전체</option>
            <option value="agreed">현재 동의</option>
            <option value="pending">현재 미동의</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">푸시 채널</span>
          <Select
            value={pushEnabledFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setPushEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              );
            }}
          >
            <option value="all">전체</option>
            <option value="enabled">켜짐</option>
            <option value="disabled">꺼짐</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">운영 공지</span>
          <Select
            value={announcementEnabledFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setAnnouncementEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              );
            }}
          >
            <option value="all">전체</option>
            <option value="enabled">켜짐</option>
            <option value="disabled">꺼짐</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">신규 제휴</span>
          <Select
            value={newPartnerEnabledFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setNewPartnerEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              );
            }}
          >
            <option value="all">전체</option>
            <option value="enabled">켜짐</option>
            <option value="disabled">꺼짐</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">종료 임박</span>
          <Select
            value={expiringPartnerEnabledFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setExpiringPartnerEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              );
            }}
          >
            <option value="all">전체</option>
            <option value="enabled">켜짐</option>
            <option value="disabled">꺼짐</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">리뷰 알림</span>
          <Select
            value={reviewEnabledFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setReviewEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              );
            }}
          >
            <option value="all">전체</option>
            <option value="enabled">켜짐</option>
            <option value="disabled">꺼짐</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">Mattermost</span>
          <Select
            value={mmEnabledFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setMmEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              );
            }}
          >
            <option value="all">전체</option>
            <option value="enabled">켜짐</option>
            <option value="disabled">꺼짐</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">마케팅/이벤트</span>
          <Select
            value={marketingEnabledFilter}
            onChange={(event) => {
              resetPage();
              setPageInputValue("1");
              setMarketingEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              );
            }}
          >
            <option value="all">전체</option>
            <option value="enabled">켜짐</option>
            <option value="disabled">꺼짐</option>
          </Select>
        </div>
      </FilterBar>

      <p className="text-sm text-muted-foreground">
        총 {members.length}명 중 {filteredMembers.length}명 검색됨
      </p>

      {filteredMembers.length === 0 ? (
        <EmptyState
          title="조건에 맞는 회원이 없습니다."
          description="검색어나 상태 필터를 조정해 다시 확인해 주세요."
        />
      ) : (
        <div className="grid min-w-0 gap-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-surface-muted/40 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              {pageStart + 1}-{Math.min(pageStart + visibleMembers.length, filteredMembers.length)} /{" "}
              {filteredMembers.length}
            </p>
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
              <label className="flex items-center justify-between gap-2 whitespace-nowrap sm:justify-start">
                <span>페이지당</span>
                <Select
                  value={String(pageSize)}
                  onChange={(event) => {
                    const nextPageSize = Number(event.target.value) as
                      | (typeof MEMBER_PAGE_SIZE_OPTIONS)[number];
                    setPageSize(nextPageSize);
                    setPage(1);
                    setPageInputValue("1");
                  }}
                >
                  {MEMBER_PAGE_SIZE_OPTIONS.map((option) => (
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
                  min={1}
                  max={totalPages}
                  value={pageInputValue}
                  onChange={(event) => setPageInputValue(event.target.value)}
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
          {visibleMembers.map((member) => (
            <AdminMemberListItem
              key={member.id}
              member={member}
              activePolicyVersions={activePolicyVersions}
              updateAction={updateMember}
              deleteAction={deleteMember}
            />
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
