import { AFFILIATION_SEGMENT_REGEX, CAMPUS_NAMES } from "./constants.ts";
import type { AffiliationMatch } from "./types.ts";

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

export function extractAffiliation(text: string): AffiliationMatch {
  const segments = Array.from(text.matchAll(AFFILIATION_SEGMENT_REGEX)).map(
    (match) => match[1] ?? "",
  );
  const candidates = segments.length > 0 ? segments : [text];
  const campusMatches = new Set<string>();
  let campusRaw: string | undefined;

  for (const candidate of candidates) {
    const exactCampuses = CAMPUS_NAMES.filter((campus) => candidate.includes(campus));
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
