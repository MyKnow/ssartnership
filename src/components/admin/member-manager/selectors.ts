import { parseSsafyProfile } from "../../../lib/mm-profile.ts";

export type AdminMember = {
  id: string;
  mmUserId: string;
  mmUsername: string;
  displayName?: string | null;
  generation?: number | null;
  staffSourceGeneration?: number | null;
  campus?: string | null;
  mustChangePassword: boolean;
  serviceConsent: boolean;
  privacyConsent: boolean;
  marketingConsent: boolean | null;
  hasProfileImage: boolean;
  notificationPreferences?: {
    enabled: boolean;
    announcementEnabled: boolean;
    newPartnerEnabled: boolean;
    expiringPartnerEnabled: boolean;
    reviewEnabled: boolean;
    mmEnabled: boolean;
    marketingEnabled: boolean;
    activeDeviceCount?: number;
  };
  createdAt?: string | null;
  updatedAt?: string | null;
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
  _generation: number | null;
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

function getConsentStatus(value?: boolean | null) {
  return value ? "agreed" : "pending";
}

function getNotificationPreferenceStatus(value?: boolean | null) {
  return value ? "enabled" : "disabled";
}

export function normalizeAdminMembers(members: AdminMember[]): NormalizedMember[] {
  return members.map((member) => {
    const profile = parseSsafyProfile(member.displayName ?? member.mmUsername);
    const displayName =
      profile.displayName ?? member.displayName ?? member.mmUsername;
    const campus = member.campus ?? profile.campus ?? "";

    return {
      ...member,
      _displayName: displayName,
      _search: [
        member.mmUsername,
        member.mmUserId,
        member.displayName ?? "",
        displayName,
      ]
        .join(" ")
        .toLowerCase(),
      _campus: campus,
      _generation: member.generation ?? null,
      _serviceConsentStatus: getConsentStatus(member.serviceConsent),
      _privacyConsentStatus: getConsentStatus(member.privacyConsent),
      _marketingConsentStatus: getConsentStatus(member.marketingConsent),
      _pushEnabledStatus: getNotificationPreferenceStatus(
        member.notificationPreferences?.enabled,
      ),
      _announcementEnabledStatus: getNotificationPreferenceStatus(
        member.notificationPreferences?.announcementEnabled,
      ),
      _newPartnerEnabledStatus: getNotificationPreferenceStatus(
        member.notificationPreferences?.newPartnerEnabled,
      ),
      _expiringPartnerEnabledStatus: getNotificationPreferenceStatus(
        member.notificationPreferences?.expiringPartnerEnabled,
      ),
      _reviewEnabledStatus: getNotificationPreferenceStatus(
        member.notificationPreferences?.reviewEnabled,
      ),
      _mmEnabledStatus: getNotificationPreferenceStatus(
        member.notificationPreferences?.mmEnabled,
      ),
      _marketingEnabledStatus: getNotificationPreferenceStatus(
        member.notificationPreferences?.marketingEnabled,
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
        .map((member) => member._generation)
        .filter((generation): generation is number => generation !== null),
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
            ? member.mustChangePassword
            : !member.mustChangePassword,
        );

  const searchFiltered = query
    ? statusFiltered.filter((member) => member._search.includes(query))
    : statusFiltered;
  const generationFiltered =
    yearFilter === "all"
      ? searchFiltered
      : searchFiltered.filter(
          (member) => String(member._generation ?? "") === yearFilter,
        );
  const campusFiltered =
    campusFilter === "all"
      ? generationFiltered
      : generationFiltered.filter((member) => member._campus === campusFilter);
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
    if (a.mustChangePassword !== b.mustChangePassword) {
      return a.mustChangePassword ? -1 : 1;
    }
    if (sortValue === "updated") {
      return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
    }
    if (sortValue === "name") {
      const compare = a._displayName.localeCompare(b._displayName, "ko");
      if (compare !== 0) {
        return compare;
      }
    }
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });
}
