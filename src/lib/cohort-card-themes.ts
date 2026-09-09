import { sanitizeHexColor } from "@/lib/validation";

export type CohortCardTheme = {
  cohortYear: number;
  displayName: string | null;
  backgroundFrom: string;
  backgroundVia: string;
  backgroundTo: string;
  accentColor: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CohortCardThemeInput = {
  cohortYear: number;
  displayName: string | null;
  backgroundFrom: string;
  backgroundVia: string;
  backgroundTo: string;
  accentColor: string;
};

export type CohortCardThemeRow = {
  cohort_year?: unknown;
  display_name?: unknown;
  background_from?: unknown;
  background_via?: unknown;
  background_to?: unknown;
  accent_color?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export const DEFAULT_STUDENT_CARD_THEME: CohortCardTheme = {
  cohortYear: 1,
  displayName: "기본 교육생",
  backgroundFrom: "#081826",
  backgroundVia: "#102a43",
  backgroundTo: "#111827",
  accentColor: "#60a5fa",
  createdAt: null,
  updatedAt: null,
};

function normalizeThemeHex(value: unknown, fallback: string) {
  return sanitizeHexColor(typeof value === "string" ? value : null) ?? fallback;
}

function normalizeThemeName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 40) : null;
}

function normalizeCohortYear(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  if (value < 1 || value > 99) {
    return null;
  }
  return value;
}

export function normalizeCohortCardTheme(
  row: CohortCardThemeRow | null | undefined,
): CohortCardTheme | null {
  const cohortYear = normalizeCohortYear(row?.cohort_year);
  if (cohortYear === null) {
    return null;
  }

  return {
    cohortYear,
    displayName: normalizeThemeName(row?.display_name),
    backgroundFrom: normalizeThemeHex(
      row?.background_from,
      DEFAULT_STUDENT_CARD_THEME.backgroundFrom,
    ),
    backgroundVia: normalizeThemeHex(
      row?.background_via,
      DEFAULT_STUDENT_CARD_THEME.backgroundVia,
    ),
    backgroundTo: normalizeThemeHex(
      row?.background_to,
      DEFAULT_STUDENT_CARD_THEME.backgroundTo,
    ),
    accentColor: normalizeThemeHex(
      row?.accent_color,
      DEFAULT_STUDENT_CARD_THEME.accentColor,
    ),
    createdAt: typeof row?.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row?.updated_at === "string" ? row.updated_at : null,
  };
}

function parseCohortYear(value: string) {
  if (!/^\d{1,2}$/.test(value)) {
    throw new Error("cohort_theme_invalid_year");
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99) {
    throw new Error("cohort_theme_invalid_year");
  }
  return parsed;
}

function parseRequiredColor(value: FormDataEntryValue | null, errorCode: string) {
  const color = sanitizeHexColor(typeof value === "string" ? value : null);
  if (!color) {
    throw new Error(errorCode);
  }
  return color;
}

export function parseCohortCardThemePayload(formData: FormData): CohortCardThemeInput {
  const cohortYearRaw = String(formData.get("cohortYear") || "").trim();
  const displayName = normalizeThemeName(formData.get("displayName"));

  if (!cohortYearRaw) {
    throw new Error("cohort_theme_missing_fields");
  }

  return {
    cohortYear: parseCohortYear(cohortYearRaw),
    displayName,
    backgroundFrom: parseRequiredColor(
      formData.get("backgroundFrom"),
      "cohort_theme_invalid_color",
    ),
    backgroundVia: parseRequiredColor(
      formData.get("backgroundVia"),
      "cohort_theme_invalid_color",
    ),
    backgroundTo: parseRequiredColor(
      formData.get("backgroundTo"),
      "cohort_theme_invalid_color",
    ),
    accentColor: parseRequiredColor(
      formData.get("accentColor"),
      "cohort_theme_invalid_color",
    ),
  };
}

export function parseCohortCardThemeDeletePayload(formData: FormData) {
  const cohortYearRaw = String(formData.get("cohortYear") || "").trim();
  if (!cohortYearRaw) {
    throw new Error("cohort_theme_missing_fields");
  }
  return {
    cohortYear: parseCohortYear(cohortYearRaw),
  };
}

export function findCohortCardTheme(
  themes: readonly CohortCardTheme[] | null | undefined,
  cohortYear: number | null | undefined,
) {
  if (typeof cohortYear !== "number") {
    return null;
  }
  return themes?.find((theme) => theme.cohortYear === cohortYear) ?? null;
}

export function hexToRgb(hex: string) {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16),
  };
}

export function hexToRgba(hex: string, alpha: number) {
  const { red, green, blue } = hexToRgb(hex);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function srgbToLinear(value: number) {
  const normalized = value / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function getRelativeLuminance(hex: string) {
  const { red, green, blue } = hexToRgb(hex);
  return (
    0.2126 * srgbToLinear(red) +
    0.7152 * srgbToLinear(green) +
    0.0722 * srgbToLinear(blue)
  );
}

export function getContrastRatio(left: string, right: string) {
  const leftLuminance = getRelativeLuminance(left);
  const rightLuminance = getRelativeLuminance(right);
  const lighter = Math.max(leftLuminance, rightLuminance);
  const darker = Math.min(leftLuminance, rightLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getReadableTextColor(background: string) {
  const whiteContrast = getContrastRatio(background, "#ffffff");
  const darkContrast = getContrastRatio(background, "#0f172a");
  return whiteContrast >= darkContrast ? "#ffffff" : "#0f172a";
}

export function getReadableTextColorForGradient(colors: readonly string[]) {
  const whiteScore = colors.reduce(
    (score, color) => score + getContrastRatio(color, "#ffffff"),
    0,
  );
  const darkScore = colors.reduce(
    (score, color) => score + getContrastRatio(color, "#0f172a"),
    0,
  );
  return whiteScore >= darkScore ? "#ffffff" : "#0f172a";
}
