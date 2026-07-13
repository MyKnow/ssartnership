import type { Metadata } from "next";
import {
  deleteCohortCardTheme,
  earlyStartSsafyCycle,
  restoreSsafyCycleSettings,
  updateSsafyCycleSettings,
  upsertCohortCardTheme,
} from "@/app/admin/(protected)/actions";
import AdminCycleView from "@/components/admin/AdminCycleView";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { listCohortCardThemes } from "@/lib/cohort-card-themes";
import {
  getSsafyCycleOverview,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import { getCurrentSsafySemester } from "@/lib/ssafy-year";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `기수 관리 | ${SITE_NAME}`,
  robots: { index: false, follow: true },
};

export default async function AdminCyclePage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; error?: string }>;
}) {
  await requireAdminPermission("cycles", "read", { path: "/admin/cycle" });
  const params = (await searchParams) ?? {};
  const [settings, themes] = await Promise.all([
    getSsafyCycleSettings(),
    listCohortCardThemes(),
  ]);

  return (
    <AdminShell title="기수 관리" backHref="/admin" backLabel="관리 홈">
      <AdminCycleView
        settings={settings}
        overview={getSsafyCycleOverview(settings)}
        themes={themes}
        currentSemester={getCurrentSsafySemester()}
        initialTimestamp={new Date().toISOString()}
        status={params.status}
        errorMessage={
          params.error ? adminActionErrorMessages[params.error] : null
        }
        updateSettingsAction={updateSsafyCycleSettings}
        earlyStartAction={earlyStartSsafyCycle}
        restoreAction={restoreSsafyCycleSettings}
        upsertThemeAction={upsertCohortCardTheme}
        deleteThemeAction={deleteCohortCardTheme}
      />
    </AdminShell>
  );
}
