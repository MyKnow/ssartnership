import { ROLE_PRIORITY, STAFF_YEAR_HINT, STUDENT_ROLE_TOKENS } from "./constants.ts";
import { extractAffiliation } from "./affiliation.ts";
import {
  extractPersonLikeName,
  isPersonLikeName,
  normalizeNicknameText,
  removeTrailingRoleToken,
  stripMetadataTail,
} from "./text.ts";
import type {
  ParsedProfile,
  ProfileCandidateSource,
  RoleMatch,
} from "./types.ts";

function findRoleMatch(text: string): RoleMatch | null {
  for (const token of STUDENT_ROLE_TOKENS) {
    if (text.includes(token)) {
      return { roleTitle: token, kind: "student" };
    }
  }

  for (const item of ROLE_PRIORITY) {
    if (item.kind !== "staff") {
      continue;
    }
    if (text.includes(item.token)) {
      return {
        roleTitle: item.normalized ?? item.token,
        kind: "staff",
      };
    }
  }

  return null;
}

function getPrimaryDisplayName(value: string) {
  const withMetadataRemoved = stripMetadataTail(value);
  const withoutTrailingRole = removeTrailingRoleToken(withMetadataRemoved);
  const personLike = extractPersonLikeName(withoutTrailingRole);
  return personLike ?? withoutTrailingRole;
}

function buildParsedProfile(parsedInput: string): ParsedProfile {
  const normalizedInput = normalizeNicknameText(parsedInput);
  if (!normalizedInput) {
    return {
      parsedExclusionReason: "display_name_not_person_like",
      parseModeCandidateMatch: false,
    };
  }

  const roleMatch = findRoleMatch(normalizedInput);
  const affiliation = extractAffiliation(normalizedInput);
  const primaryDisplayName = getPrimaryDisplayName(normalizedInput);
  const personLike = isPersonLikeName(primaryDisplayName);
  const studentSignal = roleMatch?.kind === "student";
  const staffSignal = roleMatch?.kind === "staff";
  const hasCampus = Boolean(affiliation.campus);
  const displayName =
    staffSignal && !personLike ? normalizedInput : primaryDisplayName;

  let parsedExclusionReason: string | undefined;
  let parseModeCandidateMatch = false;
  let isStaff = false;

  if (staffSignal) {
    isStaff = true;
    parseModeCandidateMatch = true;
  } else if (!personLike) {
    parsedExclusionReason = "display_name_not_person_like";
  } else if (studentSignal) {
    if (affiliation.ambiguous) {
      parsedExclusionReason = "campus_ambiguous";
    } else if (!hasCampus) {
      parsedExclusionReason = "student_signal_without_affiliation";
    } else {
      parseModeCandidateMatch = true;
    }
  } else if (affiliation.ambiguous) {
    parsedExclusionReason = "campus_ambiguous";
  } else if (hasCampus) {
    parseModeCandidateMatch = true;
  } else {
    parsedExclusionReason = "display_only";
  }

  const shouldExposeCampus = Boolean(affiliation.campus) && !affiliation.ambiguous;

  return {
    displayName,
    parsedName: displayName,
    ...(shouldExposeCampus && affiliation.campusRaw
      ? { parsedCampusRaw: affiliation.campusRaw }
      : {}),
    ...(shouldExposeCampus && affiliation.campus
      ? {
          campus: affiliation.campus,
          parsedCampusNormalized: affiliation.campus,
          parsedRegionNormalized: affiliation.campus,
        }
      : {}),
    ...(roleMatch
      ? {
          roleTitle: roleMatch.roleTitle,
          parsedRoleTitle: roleMatch.roleTitle,
        }
      : {}),
    ...(isStaff
      ? {
          isStaff: true,
          suggestedYear: STAFF_YEAR_HINT,
        }
      : {}),
    parseModeCandidateMatch,
    ...(parsedExclusionReason ? { parsedExclusionReason } : {}),
  };
}

function buildUserCandidates(user: ProfileCandidateSource) {
  const candidates: string[] = [];
  const nickname = user.nickname?.trim();
  const firstName = user.first_name?.trim();
  const lastName = user.last_name?.trim();
  const username = user.username?.trim();

  if (nickname) {
    candidates.push(nickname);
  }

  const lastFirst = [lastName, firstName].filter(Boolean).join("");
  const firstLast = [firstName, lastName].filter(Boolean).join("");

  if (lastFirst && !candidates.includes(lastFirst)) {
    candidates.push(lastFirst);
  }
  if (firstLast && !candidates.includes(firstLast)) {
    candidates.push(firstLast);
  }
  if (username && !candidates.includes(username)) {
    candidates.push(username);
  }

  return candidates;
}

export function parseSsafyProfile(displayName?: string): ParsedProfile {
  if (!displayName) {
    return {};
  }
  return buildParsedProfile(displayName);
}

export function parseSsafyProfileFromUser(
  user?: ProfileCandidateSource | null,
): ParsedProfile {
  if (!user) {
    return {};
  }

  const candidates = buildUserCandidates(user);
  if (candidates.length === 0) {
    return {};
  }

  return buildParsedProfile(candidates[0]!);
}
