import type { PushAudienceScope, PushMessageLog } from "@/lib/push";

export type PartnerOption = {
  id: string;
  name: string;
};

export type MemberOption = {
  id: string;
  display_name: string | null;
  mm_username: string;
  year: number | null;
  campus: string | null;
};

export type AdminPushManagerProps = {
  configured: boolean;
  activeSubscriptions: number;
  enabledMembers: number;
  partners: PartnerOption[];
  members: MemberOption[];
  recentLogs: PushMessageLog[];
};

export type SortOption = "newest" | "oldest" | "delivered" | "failed";

export type AdminPushComposerState = {
  title: string;
  body: string;
  url: string;
  selectedPartnerId: string;
  audienceScope: PushAudienceScope;
  selectedYear: string;
  selectedCampus: string;
  selectedMemberId: string;
};

export type AdminPushLogFilterState = {
  search: string;
  typeFilter: PushMessageLog["type"] | "all";
  sourceFilter: PushMessageLog["source"] | "all";
  statusFilter: PushMessageLog["status"] | "all";
  audienceFilter: PushAudienceScope | "all";
  sort: SortOption;
};
