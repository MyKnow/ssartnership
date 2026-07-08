import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/admin-access";
import {
  clearSsafyCycleOverride,
  getConfiguredCurrentSsafyYear,
  getSsafyCycleSettings,
  setSsafyCycleEarlyStart,
  upsertSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import {
  deleteCohortCardTheme,
  upsertCohortCardTheme,
} from "@/lib/cohort-card-themes";
import {
  logAdminAction,
  revalidateCyclePaths,
} from "./shared-helpers";
import {
  parseCohortCardThemeDeletePayloadOrRedirect,
  parseCohortCardThemePayloadOrRedirect,
  parseSsafyCycleSettingsPayloadOrRedirect,
} from "./shared-parser-redirects";

export async function updateSsafyCycleSettingsAction(formData: FormData) {
  await requireAdminPermission("cycles", "update", { path: "/admin/cycle" });
  const payload = parseSsafyCycleSettingsPayloadOrRedirect(
    formData,
    "/admin/cycle",
  );
  await upsertSsafyCycleSettings(payload);
  await logAdminAction("cycle_settings_update", {
    targetType: "cycle_settings",
    targetId: "singleton",
    properties: payload,
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=updated");
}

export async function earlyStartSsafyCycleAction() {
  await requireAdminPermission("cycles", "update", { path: "/admin/cycle" });
  const settings = await getSsafyCycleSettings();
  const currentYear = getConfiguredCurrentSsafyYear(settings);
  const targetYear = currentYear + 1;
  await setSsafyCycleEarlyStart(targetYear);
  await logAdminAction("cycle_settings_early_start", {
    targetType: "cycle_settings",
    targetId: "singleton",
    properties: {
      currentYear,
      targetYear,
      anchorYear: settings.anchorYear,
      anchorCalendarYear: settings.anchorCalendarYear,
      anchorMonth: settings.anchorMonth,
    },
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=early-started");
}

export async function restoreSsafyCycleSettingsAction() {
  await requireAdminPermission("cycles", "update", { path: "/admin/cycle" });
  const settings = await getSsafyCycleSettings();
  await clearSsafyCycleOverride();
  await logAdminAction("cycle_settings_restore", {
    targetType: "cycle_settings",
    targetId: "singleton",
    properties: {
      currentYear: getConfiguredCurrentSsafyYear(settings),
      anchorYear: settings.anchorYear,
      anchorCalendarYear: settings.anchorCalendarYear,
      anchorMonth: settings.anchorMonth,
    },
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=restored");
}

export async function upsertCohortCardThemeAction(formData: FormData) {
  await requireAdminPermission("cycles", "update", { path: "/admin/cycle" });
  const payload = parseCohortCardThemePayloadOrRedirect(
    formData,
    "/admin/cycle",
  );
  await upsertCohortCardTheme(payload);
  await logAdminAction("cohort_card_theme_upsert", {
    targetType: "ssafy_cohort_card_theme",
    targetId: String(payload.cohortYear),
    properties: {
      cohortYear: payload.cohortYear,
      displayName: payload.displayName,
      backgroundFrom: payload.backgroundFrom,
      backgroundVia: payload.backgroundVia,
      backgroundTo: payload.backgroundTo,
      accentColor: payload.accentColor,
    },
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=theme-saved#card-theme-manager");
}

export async function deleteCohortCardThemeAction(formData: FormData) {
  await requireAdminPermission("cycles", "delete", { path: "/admin/cycle" });
  const payload = parseCohortCardThemeDeletePayloadOrRedirect(
    formData,
    "/admin/cycle",
  );
  await deleteCohortCardTheme(payload.cohortYear);
  await logAdminAction("cohort_card_theme_delete", {
    targetType: "ssafy_cohort_card_theme",
    targetId: String(payload.cohortYear),
    properties: payload,
  });
  revalidateCyclePaths();
  redirect("/admin/cycle?status=theme-deleted#card-theme-manager");
}
