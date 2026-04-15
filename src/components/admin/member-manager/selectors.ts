import { parseSsafyProfile } from "../../../lib/mm-profile.ts";

export type AdminMember = {
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

export type MemberSortOption = "recent" | "updated" | "name";
export type MemberFilterOption = "all" | "normal" | "mustChangePassword";
export type YearFilterOption = "all" | `${number}`;

export type NormalizedMember = AdminMember & {
  _displayName: string;
  _search: string;
  _campus: string;
  _year: number | null;
};

export function normalizeAdminMembers(members: AdminMember[]): NormalizedMember[] {
  return members.map((member) => {
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
  });
}

export function getAdminMemberCampusOptions(members: NormalizedMember[]) {
  return Array.from(
    new Set(members.map((member) => member._campus).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "ko"));
}

export function getAdminMemberYearOptions(members: NormalizedMember[]) {
  return Array.from(
    new Set(
      members
        .map((member) => member._year)
        .filter((year): year is number => year !== null),
    ),
  ).sort((a, b) => b - a);
}

export function filterAdminMembers({
  members,
  searchValue,
  sortValue,
  filterValue,
  yearFilter,
  campusFilter,
}: {
  members: NormalizedMember[];
  searchValue: string;
  sortValue: MemberSortOption;
  filterValue: MemberFilterOption;
  yearFilter: YearFilterOption;
  campusFilter: string;
}) {
  const query = searchValue.trim().toLowerCase();
  const statusFiltered =
    filterValue === "all"
      ? members
      : members.filter((member) =>
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
      : searchFiltered.filter((member) => String(member._year ?? "") === yearFilter);
  const campusFiltered =
    campusFilter === "all"
      ? yearFiltered
      : yearFiltered.filter((member) => member._campus === campusFilter);

  return [...campusFiltered].sort((a, b) => {
    if (a.must_change_password !== b.must_change_password) {
      return a.must_change_password ? -1 : 1;
    }
    if (sortValue === "updated") {
      return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
    }
    if (sortValue === "name") {
      const compare = a._displayName.localeCompare(b._displayName, "ko");
      if (compare !== 0) {
        return compare;
      }
    }
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });
}
