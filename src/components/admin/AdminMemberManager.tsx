"use client";

import { useMemo, useState } from "react";
import { parseSsafyProfile } from "@/lib/mm-profile";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/ui/FilterBar";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import AdminMemberCard from "@/components/admin/AdminMemberCard";

type AdminMember = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name?: string | null;
  year?: number | null;
  staff_source_year?: number | null;
  campus?: string | null;
  must_change_password: boolean;
  avatar_content_type?: string | null;
  avatar_base64?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MemberSortOption = "recent" | "updated" | "name";
type MemberFilterOption = "all" | "normal" | "mustChangePassword";
type YearFilterOption = "all" | `${number}`;

type NormalizedMember = AdminMember & {
  _displayName: string;
  _search: string;
  _campus: string;
  _year: number | null;
};

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

  const normalizedMembers = useMemo<NormalizedMember[]>(
    () =>
      members.map((member) => {
        const profile = parseSsafyProfile(member.display_name ?? member.mm_username);
        const displayName =
          profile.displayName ?? member.display_name ?? member.mm_username;
        const campus = member.campus ?? profile.campus ?? "";

        return {
          ...member,
          _displayName: displayName,
          _search: [
            member.mm_username,
            member.mm_user_id,
            member.display_name ?? "",
            displayName,
          ]
            .join(" ")
            .toLowerCase(),
          _campus: campus,
          _year: member.year ?? null,
        };
      }),
    [members],
  );

  const campusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          normalizedMembers
            .map((member) => member._campus)
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "ko")),
    [normalizedMembers],
  );

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          normalizedMembers
            .map((member) => member._year)
            .filter((year): year is number => year !== null),
        ),
      ).sort((a, b) => b - a),
    [normalizedMembers],
  );

  const filteredMembers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    const statusFiltered =
      filterValue === "all"
        ? normalizedMembers
        : normalizedMembers.filter((member) =>
            filterValue === "mustChangePassword"
              ? member.must_change_password
              : !member.must_change_password,
          );

    const searchFiltered = query
      ? statusFiltered.filter((member) => member._search.includes(query))
      : statusFiltered;

    const yearFiltered =
      yearFilter === "all"
        ? searchFiltered
        : searchFiltered.filter(
            (member) => String(member._year ?? "") === yearFilter,
          );

    const campusFiltered =
      campusFilter === "all"
        ? yearFiltered
        : yearFiltered.filter((member) => member._campus === campusFilter);

    return [...campusFiltered].sort((a, b) => {
      if (a.must_change_password !== b.must_change_password) {
        return a.must_change_password ? -1 : 1;
      }

      if (sortValue === "updated") {
        return (
          new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
        );
      }

      if (sortValue === "name") {
        const compare = a._displayName.localeCompare(b._displayName, "ko");
        if (compare !== 0) {
          return compare;
        }
      }

      return (
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
      );
    });
  }, [
    campusFilter,
    filterValue,
    normalizedMembers,
    searchValue,
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
        <div className="grid min-w-0 gap-6 xl:grid-cols-2">
          {filteredMembers.map((member) => (
            <AdminMemberCard
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
