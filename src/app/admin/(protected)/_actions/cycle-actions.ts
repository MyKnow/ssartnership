import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  clearSsafyCycleOverride,
  getConfiguredCurrentSsafyYear,
  getSsafyCycleSettings,
  setSsafyCycleEarlyStart,
  upsertSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import {
  logAdminAction,
  revalidateCyclePaths,
} from "./shared-helpers";
import { parseSsafyCycleSettingsPayloadOrRedirect } from "./shared-parser-redirects";

export async function updateSsafyCycleSettingsAction(formData: FormData) {
  await requireAdmin();
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
  await requireAdmin();
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
  await requireAdmin();
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
