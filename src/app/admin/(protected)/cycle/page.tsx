import type { Metadata } from "next";
import {
  deleteCohortCardTheme,
  disableMattermostSender,
  earlyStartSsafyCycle,
  restoreSsafyCycleSettings,
  saveMattermostSenderCandidate,
  testMattermostSenderCandidate,
  updateSsafyCycleSettings,
  upsertCohortCardTheme,
} from "@/app/admin/(protected)/actions";
import AdminCycleView from "@/components/admin/AdminCycleView";
import AdminShell from "@/components/admin/AdminShell";
import { requireAdminPermission } from "@/lib/admin-access";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { canManageMattermostSenders } from "@/lib/mattermost-senders/access";
import { mattermostSenderRepository } from "@/lib/mattermost-senders/repository";
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
  searchParams?: Promise<{
    status?: string;
    error?: string;
    generation?: string;
  }>;
}) {
  const session = await requireAdminPermission("cycles", "read", { path: "/admin/cycle" });
  const params = (await searchParams) ?? {};
  const canManageSenders = canManageMattermostSenders(session.account, "read");
  const [settings, themes, senderResult] = await Promise.all([
    getSsafyCycleSettings(),
    listCohortCardThemes(),
    canManageSenders
      ? mattermostSenderRepository
          .listMetadata()
          .then((senders) => ({ senders, loadError: false }))
          .catch(() => ({ senders: [], loadError: true }))
      : Promise.resolve({ senders: [], loadError: false }),
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
        requestedGeneration={params.generation}
        errorMessage={
          params.error ? adminActionErrorMessages[params.error] : null
        }
        updateSettingsAction={updateSsafyCycleSettings}
        earlyStartAction={earlyStartSsafyCycle}
        restoreAction={restoreSsafyCycleSettings}
        upsertThemeAction={upsertCohortCardTheme}
        deleteThemeAction={deleteCohortCardTheme}
        mattermostSenders={canManageSenders ? senderResult.senders : undefined}
        mattermostSenderLoadError={canManageSenders ? senderResult.loadError : undefined}
        saveMattermostSenderAction={canManageSenders ? saveMattermostSenderCandidate : undefined}
        testMattermostSenderAction={canManageSenders ? testMattermostSenderCandidate : undefined}
        disableMattermostSenderAction={canManageSenders ? disableMattermostSender : undefined}
      />
    </AdminShell>
  );
}
