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
  service_policy_version?: number | null;
  service_policy_consented_at?: string | null;
  privacy_policy_version?: number | null;
  privacy_policy_consented_at?: string | null;
  marketing_policy_version?: number | null;
  marketing_policy_consented_at?: string | null;
  notification_preferences?: {
    enabled: boolean;
    announcementEnabled: boolean;
    newPartnerEnabled: boolean;
    expiringPartnerEnabled: boolean;
    reviewEnabled: boolean;
    mmEnabled: boolean;
    marketingEnabled: boolean;
    activeDeviceCount?: number;
  };
  consent_history?: Array<{
    kind: "service" | "privacy" | "marketing";
    version: number;
    agreed_at: string;
    title?: string | null;
    effective_at?: string | null;
  }>;
  avatar_content_type?: string | null;
  avatar_base64?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type MemberSortOption = "recent" | "updated" | "name";
export type MemberFilterOption = "all" | "normal" | "mustChangePassword";
export type YearFilterOption = "all" | `${number}`;
export type ConsentFilterOption = "all" | "agreed" | "pending";
export type NotificationPreferenceFilterOption = "all" | "enabled" | "disabled";

export type NormalizedMember = AdminMember & {
  _displayName: string;
  _search: string;
  _campus: string;
  _year: number | null;
  _serviceConsentStatus: ConsentFilterOption;
  _privacyConsentStatus: ConsentFilterOption;
  _marketingConsentStatus: ConsentFilterOption;
  _pushEnabledStatus: NotificationPreferenceFilterOption;
  _announcementEnabledStatus: NotificationPreferenceFilterOption;
  _newPartnerEnabledStatus: NotificationPreferenceFilterOption;
  _expiringPartnerEnabledStatus: NotificationPreferenceFilterOption;
  _reviewEnabledStatus: NotificationPreferenceFilterOption;
  _mmEnabledStatus: NotificationPreferenceFilterOption;
  _marketingEnabledStatus: NotificationPreferenceFilterOption;
};

function getConsentStatus(value?: number | null) {
  return value ? "agreed" : "pending";
}

function getNotificationPreferenceStatus(value?: boolean | null) {
  return value ? "enabled" : "disabled";
}

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
      _serviceConsentStatus: getConsentStatus(member.service_policy_version),
      _privacyConsentStatus: getConsentStatus(member.privacy_policy_version),
      _marketingConsentStatus: getConsentStatus(member.marketing_policy_version),
      _pushEnabledStatus: getNotificationPreferenceStatus(
        member.notification_preferences?.enabled,
      ),
      _announcementEnabledStatus: getNotificationPreferenceStatus(
        member.notification_preferences?.announcementEnabled,
      ),
      _newPartnerEnabledStatus: getNotificationPreferenceStatus(
        member.notification_preferences?.newPartnerEnabled,
      ),
      _expiringPartnerEnabledStatus: getNotificationPreferenceStatus(
        member.notification_preferences?.expiringPartnerEnabled,
      ),
      _reviewEnabledStatus: getNotificationPreferenceStatus(
        member.notification_preferences?.reviewEnabled,
      ),
      _mmEnabledStatus: getNotificationPreferenceStatus(
        member.notification_preferences?.mmEnabled,
      ),
      _marketingEnabledStatus: getNotificationPreferenceStatus(
        member.notification_preferences?.marketingEnabled,
      ),
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
  serviceConsentFilter = "all",
  privacyConsentFilter = "all",
  marketingConsentFilter = "all",
  pushEnabledFilter = "all",
  announcementEnabledFilter = "all",
  newPartnerEnabledFilter = "all",
  expiringPartnerEnabledFilter = "all",
  reviewEnabledFilter = "all",
  mmEnabledFilter = "all",
  marketingEnabledFilter = "all",
}: {
  members: NormalizedMember[];
  searchValue: string;
  sortValue: MemberSortOption;
  filterValue: MemberFilterOption;
  yearFilter: YearFilterOption;
  campusFilter: string;
  serviceConsentFilter?: ConsentFilterOption;
  privacyConsentFilter?: ConsentFilterOption;
  marketingConsentFilter?: ConsentFilterOption;
  pushEnabledFilter?: NotificationPreferenceFilterOption;
  announcementEnabledFilter?: NotificationPreferenceFilterOption;
  newPartnerEnabledFilter?: NotificationPreferenceFilterOption;
  expiringPartnerEnabledFilter?: NotificationPreferenceFilterOption;
  reviewEnabledFilter?: NotificationPreferenceFilterOption;
  mmEnabledFilter?: NotificationPreferenceFilterOption;
  marketingEnabledFilter?: NotificationPreferenceFilterOption;
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
  const serviceConsentFiltered =
    serviceConsentFilter === "all"
      ? campusFiltered
      : campusFiltered.filter(
          (member) => member._serviceConsentStatus === serviceConsentFilter,
        );
  const privacyConsentFiltered =
    privacyConsentFilter === "all"
      ? serviceConsentFiltered
      : serviceConsentFiltered.filter(
          (member) => member._privacyConsentStatus === privacyConsentFilter,
        );
  const marketingConsentFiltered =
    marketingConsentFilter === "all"
      ? privacyConsentFiltered
      : privacyConsentFiltered.filter(
          (member) => member._marketingConsentStatus === marketingConsentFilter,
        );
  const pushEnabledFiltered =
    pushEnabledFilter === "all"
      ? marketingConsentFiltered
      : marketingConsentFiltered.filter(
          (member) => member._pushEnabledStatus === pushEnabledFilter,
        );
  const announcementEnabledFiltered =
    announcementEnabledFilter === "all"
      ? pushEnabledFiltered
      : pushEnabledFiltered.filter(
          (member) =>
            member._announcementEnabledStatus === announcementEnabledFilter,
        );
  const newPartnerEnabledFiltered =
    newPartnerEnabledFilter === "all"
      ? announcementEnabledFiltered
      : announcementEnabledFiltered.filter(
          (member) =>
            member._newPartnerEnabledStatus === newPartnerEnabledFilter,
        );
  const expiringPartnerEnabledFiltered =
    expiringPartnerEnabledFilter === "all"
      ? newPartnerEnabledFiltered
      : newPartnerEnabledFiltered.filter(
          (member) =>
            member._expiringPartnerEnabledStatus === expiringPartnerEnabledFilter,
        );
  const reviewEnabledFiltered =
    reviewEnabledFilter === "all"
      ? expiringPartnerEnabledFiltered
      : expiringPartnerEnabledFiltered.filter(
          (member) => member._reviewEnabledStatus === reviewEnabledFilter,
        );
  const mmEnabledFiltered =
    mmEnabledFilter === "all"
      ? reviewEnabledFiltered
      : reviewEnabledFiltered.filter(
          (member) => member._mmEnabledStatus === mmEnabledFilter,
        );
  const marketingEnabledFiltered =
    marketingEnabledFilter === "all"
      ? mmEnabledFiltered
      : mmEnabledFiltered.filter(
          (member) => member._marketingEnabledStatus === marketingEnabledFilter,
        );

  return [...marketingEnabledFiltered].sort((a, b) => {
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
