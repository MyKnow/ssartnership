import { CAMPUS_DIRECTORY } from "@/lib/campuses";
import { formatSsafyYearLabel, SSAFY_STAFF_YEAR } from "@/lib/ssafy-year";

export type ManualMemberImportOption = {
  value: string;
  label: string;
};

export const MANUAL_MEMBER_IMPORT_CAMPUS_OPTIONS: readonly ManualMemberImportOption[] =
  CAMPUS_DIRECTORY.map((campus) => ({
    value: campus.label,
    label: campus.fullLabel,
  }));

export const MANUAL_MEMBER_IMPORT_CAMPUS_LABELS =
  MANUAL_MEMBER_IMPORT_CAMPUS_OPTIONS.map((option) => option.label).join(", ");

export function getManualMemberImportGenerationOptions(
  currentGeneration: number,
): ManualMemberImportOption[] {
  const maximumGeneration = Number.isSafeInteger(currentGeneration)
    ? Math.min(99, Math.max(1, currentGeneration))
    : 1;

  return Array.from({ length: maximumGeneration + 1 }, (_, generation) => ({
    value: String(generation),
    label: formatSsafyYearLabel(
      generation === SSAFY_STAFF_YEAR ? SSAFY_STAFF_YEAR : generation,
    ),
  }));
}

export function normalizeManualMemberImportCampus(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;

  return CAMPUS_DIRECTORY.find(
    (campus) => campus.label === normalized || campus.fullLabel === normalized,
  )?.label ?? null;
}
