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

export default function AdminMemberManager({
  members,
  updateMember,
  deleteMember,
}: {
  members: AdminMember[];
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

  const normalizedMembers = useMemo(() => normalizeAdminMembers(members), [members]);
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

  return (
    <div className="mt-6 grid min-w-0 gap-6">
      <FilterBar
        title="회원 필터"
        description="이름, 기수, 캠퍼스, 상태 기준으로 회원 목록을 빠르게 좁힙니다."
      >
        <div className="grid min-w-[14rem] flex-1 gap-1">
          <span className="ui-caption">검색</span>
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="이름, MM 아이디로 검색"
          />
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">기수</span>
          <Select
            value={yearFilter}
            onChange={(event) => setYearFilter(event.target.value as YearFilterOption)}
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
            onChange={(event) => setSortValue(event.target.value as MemberSortOption)}
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
            onChange={(event) =>
              setFilterValue(event.target.value as MemberFilterOption)
            }
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
            onChange={(event) => setCampusFilter(event.target.value)}
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
          <span className="ui-caption">서비스 약관</span>
          <Select
            value={serviceConsentFilter}
            onChange={(event) =>
              setServiceConsentFilter(event.target.value as ConsentFilterOption)
            }
          >
            <option value="all">전체</option>
            <option value="agreed">동의</option>
            <option value="pending">미동의</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">개인정보 약관</span>
          <Select
            value={privacyConsentFilter}
            onChange={(event) =>
              setPrivacyConsentFilter(event.target.value as ConsentFilterOption)
            }
          >
            <option value="all">전체</option>
            <option value="agreed">동의</option>
            <option value="pending">미동의</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">마케팅 약관</span>
          <Select
            value={marketingConsentFilter}
            onChange={(event) =>
              setMarketingConsentFilter(event.target.value as ConsentFilterOption)
            }
          >
            <option value="all">전체</option>
            <option value="agreed">동의</option>
            <option value="pending">미동의</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">푸시 채널</span>
          <Select
            value={pushEnabledFilter}
            onChange={(event) =>
              setPushEnabledFilter(event.target.value as NotificationPreferenceFilterOption)
            }
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
            onChange={(event) =>
              setAnnouncementEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              )
            }
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
            onChange={(event) =>
              setNewPartnerEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              )
            }
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
            onChange={(event) =>
              setExpiringPartnerEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              )
            }
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
            onChange={(event) =>
              setReviewEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              )
            }
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
            onChange={(event) =>
              setMmEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              )
            }
          >
            <option value="all">전체</option>
            <option value="enabled">켜짐</option>
            <option value="disabled">꺼짐</option>
          </Select>
        </div>
        <div className="grid min-w-[10rem] gap-1">
          <span className="ui-caption">마케팅 알림</span>
          <Select
            value={marketingEnabledFilter}
            onChange={(event) =>
              setMarketingEnabledFilter(
                event.target.value as NotificationPreferenceFilterOption,
              )
            }
          >
            <option value="all">전체</option>
            <option value="enabled">켜짐</option>
            <option value="disabled">꺼짐</option>
          </Select>
        </div>
      </FilterBar>

      <p className="text-sm text-muted-foreground">
        총 {members.length}명 중 {filteredMembers.length}명 표시
      </p>

      {filteredMembers.length === 0 ? (
        <EmptyState
          title="조건에 맞는 회원이 없습니다."
          description="검색어나 상태 필터를 조정해 다시 확인해 주세요."
        />
      ) : (
        <div className="grid min-w-0 gap-3">
          {filteredMembers.map((member) => (
            <AdminMemberListItem
              key={member.id}
              member={member}
              updateAction={updateMember}
              deleteAction={deleteMember}
            />
          ))}
        </div>
      )}
    </div>
  );
}
