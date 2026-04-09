import type { MMUser } from "@/lib/mattermost";

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

type ProfileCandidateSource = Pick<
  MMUser,
  "nickname" | "first_name" | "last_name" | "username"
>;

type RoleKind = "student" | "staff";

type RoleMatch = {
  roleTitle: string;
  kind: RoleKind;
};

type AffiliationMatch = {
  campusRaw?: string;
  campus?: string;
  ambiguous?: boolean;
};

const STAFF_YEAR_HINT = 0;

const CAMPUS_NAMES = ["서울", "광주", "구미", "부울경", "대전", "창업"] as const;

const ROLE_PRIORITY: Array<{
  token: string;
  kind: RoleKind;
  normalized?: string;
}> = [
  { token: "팀원", kind: "student", normalized: "팀원" },
  { token: "팀장", kind: "student", normalized: "팀장" },
  { token: "대표강사", kind: "staff", normalized: "강사" },
  { token: "전임강사", kind: "staff", normalized: "강사" },
  { token: "교육프로", kind: "staff", normalized: "프로" },
  { token: "운영프로", kind: "staff", normalized: "프로" },
  { token: "취업컨설턴트", kind: "staff", normalized: "컨설턴트" },
  { token: "실습코치", kind: "staff", normalized: "실습코치" },
  { token: "트랙대표", kind: "staff", normalized: "트랙대표" },
  { token: "취업지원센터", kind: "staff", normalized: "취업지원센터" },
  { token: "운영자", kind: "staff", normalized: "운영자" },
  { token: "조교", kind: "staff", normalized: "조교" },
  { token: "연구팀", kind: "staff", normalized: "연구팀" },
  { token: "사무국", kind: "staff", normalized: "사무국" },
  { token: "Consultant", kind: "staff", normalized: "컨설턴트" },
  { token: "컨설턴트", kind: "staff", normalized: "컨설턴트" },
  { token: "강사", kind: "staff", normalized: "강사" },
  { token: "프로", kind: "staff", normalized: "프로" },
];

const STUDENT_ROLE_TOKENS = ROLE_PRIORITY.filter(
  (item) => item.kind === "student",
).map((item) => item.token);

const HUMAN_NAME_REGEX = /^[가-힣]{2,4}$/u;
const DECORATIVE_EDGE_REGEX =
  /^[^\w가-힣\[\]\(\)]+|[^\w가-힣\[\]\(\)]+$/gu;
const AFFILIATION_SEGMENT_REGEX = /[\[(]([^\[\]]+)[\])]/gu;
const TRAILING_NUMERIC_ALIAS_REGEX = /\d+$/u;

function normalizeFullWidthBrackets(value: string) {
  return value
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/［/g, "[")
    .replace(/］/g, "]")
    .replace(/【/g, "[")
    .replace(/】/g, "]");
}

function normalizeNicknameText(value: string) {
  return normalizeFullWidthBrackets(value)
    .replace(/\s+/g, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu, "")
    .replace(DECORATIVE_EDGE_REGEX, "");
}

function stripTrailingNumericAlias(value: string) {
  return value.replace(TRAILING_NUMERIC_ALIAS_REGEX, "");
}

function stripMetadataTail(value: string) {
  return value.replace(/\s*(?:\[[^\]]+\]|\([^)]+\)).*$/, "").trim() || value;
}

function removeTrailingRoleToken(value: string) {
  let current = value.trim();
  let changed = true;

  while (changed) {
    changed = false;

    for (const token of ROLE_PRIORITY.map((item) => item.token)) {
      if (current.endsWith(token)) {
        current = current.slice(0, -token.length).replace(/[_\s-]+$/u, "").trim();
        changed = true;
        break;
      }
    }
  }

  return current;
}

function extractPersonLikeName(value: string) {
  const trimmed = stripTrailingNumericAlias(value).trim();
  if (!trimmed) {
    return undefined;
  }
  const match = trimmed.match(/^([가-힣]{2,4})(\d*)/u);
  const candidate = match?.[1];
  if (!candidate) {
    return undefined;
  }
  const suffix = trimmed.slice(match[0].length);
  if (suffix && !/^[\[\]\(\)_.\-/,]/u.test(suffix)) {
    return undefined;
  }
  if (CAMPUS_NAMES.some((campus) => candidate.includes(campus))) {
    return undefined;
  }
  if (ROLE_PRIORITY.some((item) => candidate.includes(item.token))) {
    return undefined;
  }
  return candidate;
}

function isPersonLikeName(value: string) {
  const candidate = extractPersonLikeName(value);
  return Boolean(candidate && HUMAN_NAME_REGEX.test(candidate));
}

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

function levenshtein(a: string, b: string) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) {
    matrix[row]![0] = row;
  }
  for (let col = 0; col < cols; col += 1) {
    matrix[0]![col] = col;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row]![col] = Math.min(
        matrix[row - 1]![col] + 1,
        matrix[row]![col - 1] + 1,
        matrix[row - 1]![col - 1] + cost,
      );
    }
  }

  return matrix[rows - 1]![cols - 1]!;
}

function resolveCampusValue(raw: string) {
  const compact = raw.replace(/[^가-힣]/gu, "");
  if (!compact) {
    return null;
  }

  for (const campus of CAMPUS_NAMES) {
    if (compact === campus || compact.includes(campus)) {
      return campus;
    }
  }

  let best: { campus: string; distance: number } | null = null;
  for (const campus of CAMPUS_NAMES) {
    const distance = levenshtein(compact, campus);
    if (!best || distance < best.distance) {
      best = { campus, distance };
    }
  }

  if (best && best.distance <= 1) {
    return best.campus;
  }

  return null;
}

function extractAffiliation(text: string): AffiliationMatch {
  const segments = Array.from(text.matchAll(AFFILIATION_SEGMENT_REGEX)).map(
    (match) => match[1] ?? "",
  );
  const candidates = segments.length > 0 ? segments : [text];
  const campusMatches = new Set<string>();
  let campusRaw: string | undefined;

  for (const candidate of candidates) {
    const exactCampuses = CAMPUS_NAMES.filter((campus) =>
      candidate.includes(campus),
    );
    if (exactCampuses.length === 1) {
      campusMatches.add(exactCampuses[0]!);
      campusRaw ??= exactCampuses[0];
    } else if (exactCampuses.length > 1) {
      exactCampuses.forEach((campus) => campusMatches.add(campus));
    }

    if (exactCampuses.length === 0) {
      const bareCampus = resolveCampusValue(candidate);
      if (bareCampus) {
        campusMatches.add(bareCampus);
        campusRaw ??= candidate.replace(/\s+/gu, "") || candidate;
      }
    }
  }

  const ambiguous = campusMatches.size > 1;

  const campus = campusMatches.size === 1 ? Array.from(campusMatches)[0] : undefined;

  return {
    campusRaw: campus ? campusRaw : undefined,
    campus,
    ambiguous,
  };
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

  const shouldExposeCampus =
    Boolean(affiliation.campus) &&
    !affiliation.ambiguous;

  return {
    displayName,
    parsedName: displayName,
    ...(shouldExposeCampus && affiliation.campusRaw
      ? {
          parsedCampusRaw: affiliation.campusRaw,
        }
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
    ...(parsedExclusionReason
      ? {
          parsedExclusionReason,
        }
      : {}),
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
