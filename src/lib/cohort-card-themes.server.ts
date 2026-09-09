import "server-only";

import { isMockDataSource } from "@/lib/mock/member";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  DEFAULT_STUDENT_CARD_THEME,
  normalizeCohortCardTheme,
  type CohortCardTheme,
  type CohortCardThemeInput,
  type CohortCardThemeRow,
} from "@/lib/cohort-card-themes";

export * from "@/lib/cohort-card-themes";

const COHORT_THEME_SELECT =
  "cohort_year,display_name,background_from,background_via,background_to,accent_color,created_at,updated_at";

export async function listCohortCardThemes() {
  if (isMockDataSource()) {
    return [
      {
        ...DEFAULT_STUDENT_CARD_THEME,
        cohortYear: 14,
        displayName: "14기",
        backgroundFrom: "#07120d",
        backgroundVia: "#0a1a15",
        backgroundTo: "#111827",
        accentColor: "#34d399",
      },
      {
        ...DEFAULT_STUDENT_CARD_THEME,
        cohortYear: 15,
        displayName: "15기",
        backgroundFrom: "#110c1f",
        backgroundVia: "#1a1430",
        backgroundTo: "#111827",
        accentColor: "#a78bfa",
      },
      {
        ...DEFAULT_STUDENT_CARD_THEME,
        cohortYear: 16,
        displayName: "16기",
        backgroundFrom: "#062a3a",
        backgroundVia: "#0f3b66",
        backgroundTo: "#111827",
        accentColor: "#38bdf8",
      },
    ];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ssafy_cohort_card_themes")
    .select(COHORT_THEME_SELECT)
    .order("cohort_year", { ascending: false });

  if (error) {
    throw new Error(error.message || "기수별 카드 색상을 불러오지 못했습니다.");
  }

  return ((data ?? []) as CohortCardThemeRow[])
    .map(normalizeCohortCardTheme)
    .filter((theme): theme is CohortCardTheme => Boolean(theme));
}

export async function upsertCohortCardTheme(input: CohortCardThemeInput) {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("ssafy_cohort_card_themes").upsert(
    {
      cohort_year: input.cohortYear,
      display_name: input.displayName,
      background_from: input.backgroundFrom,
      background_via: input.backgroundVia,
      background_to: input.backgroundTo,
      accent_color: input.accentColor,
      updated_at: now,
    },
    { onConflict: "cohort_year" },
  );

  if (error) {
    throw new Error(error.message || "기수별 카드 색상을 저장하지 못했습니다.");
  }
}

export async function deleteCohortCardTheme(cohortYear: number) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("ssafy_cohort_card_themes")
    .delete()
    .eq("cohort_year", cohortYear);

  if (error) {
    throw new Error(error.message || "기수별 카드 색상을 삭제하지 못했습니다.");
  }
}
