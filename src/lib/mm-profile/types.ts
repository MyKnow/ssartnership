import type { MMUser } from "../mattermost/types.ts";

export type ParsedProfile = {
  displayName?: string;
  parsedName?: string;
  parsedCampusRaw?: string;
  parsedCampusNormalized?: string;
  parsedRegionNormalized?: string;
  campus?: string;
  parsedRoleTitle?: string;
  roleTitle?: string;
  isStaff?: boolean;
  suggestedYear?: number;
  parseModeCandidateMatch?: boolean;
  parsedExclusionReason?: string;
};

export type ProfileCandidateSource = Pick<
  MMUser,
  "nickname" | "first_name" | "last_name" | "username"
>;

export type RoleKind = "student" | "staff";

export type RoleMatch = {
  roleTitle: string;
  kind: RoleKind;
};

export type AffiliationMatch = {
  campusRaw?: string;
  campus?: string;
  ambiguous?: boolean;
};
