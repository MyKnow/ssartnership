"use client";

import { useMemo, useState } from "react";
import { parseSsafyProfile } from "@/lib/mm-profile";
import EmptyState from "@/components/ui/EmptyState";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import AdminMemberCard from "@/components/admin/AdminMemberCard";

type AdminMember = {
  id: string;
  mm_user_id: string;
  mm_username: string;
  display_name?: string | null;
  campus?: string | null;
  class_number?: number | null;
  must_change_password: boolean;
  avatar_content_type?: string | null;
  avatar_base64?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type MemberSortOption = "recent" | "updated" | "name" | "classNumber";
type MemberFilterOption = "all" | "normal" | "mustChangePassword";

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
  const [campusFilter, setCampusFilter] = useState("all");

  const campusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          members
            .map((member) => member.campus ?? parseSsafyProfile(member.display_name ?? member.mm_username).campus ?? "")
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "ko")),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    const normalized = members.map((member) => {
      const profile = parseSsafyProfile(member.display_name ?? member.mm_username);
      const displayName =
        profile.displayName ?? member.display_name ?? member.mm_username;

      return {
        ...member,
        _displayName: displayName,
        _search: [
          member.mm_username,
          member.mm_user_id,
          member.display_name ?? "",
          displayName,
          member.campus ?? profile.campus ?? "",
          member.class_number ? `${member.class_number}` : "",
        ]
          .join(" ")
          .toLowerCase(),
        _campus: member.campus ?? profile.campus ?? "",
      };
    });

    const statusFiltered =
      filterValue === "all"
        ? normalized
        : normalized.filter((member) =>
            filterValue === "mustChangePassword"
              ? member.must_change_password
              : !member.must_change_password,
          );

    const searchFiltered = query
      ? statusFiltered.filter((member) => member._search.includes(query))
      : statusFiltered;

    const campusFiltered =
      campusFilter === "all"
        ? searchFiltered
        : searchFiltered.filter((member) => member._campus === campusFilter);

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

      if (sortValue === "classNumber") {
        const classA = a.class_number ?? Number.MAX_SAFE_INTEGER;
        const classB = b.class_number ?? Number.MAX_SAFE_INTEGER;
        if (classA !== classB) {
          return classA - classB;
        }
      }

      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
  }, [campusFilter, filterValue, members, searchValue, sortValue]);

  return (
    <div className="mt-6 grid gap-6">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
        <Input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="이름, MM 아이디, 캠퍼스, 반으로 검색"
        />
        <Select
          value={sortValue}
          onChange={(event) => setSortValue(event.target.value as MemberSortOption)}
        >
          <option value="recent">등록순</option>
          <option value="updated">최근 수정순</option>
          <option value="name">이름순</option>
          <option value="classNumber">반순</option>
        </Select>
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

      <p className="text-sm text-muted-foreground">총 {members.length}명 회원</p>

      {filteredMembers.length === 0 ? (
        <EmptyState
          title="조건에 맞는 회원이 없습니다."
          description="검색어나 상태 필터를 조정해 다시 확인해 주세요."
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
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
