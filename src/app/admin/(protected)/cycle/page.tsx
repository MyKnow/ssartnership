import type { Metadata } from "next";
import { Suspense } from "react";
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
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminShell from "@/components/admin/AdminShell";
import AdminStatePanel from "@/components/admin/AdminStatePanel";
import { AdminCycleSkeletonContent } from "@/components/loading/AdminPageSkeletons";
import Button from "@/components/ui/Button";
import { requireAdminPermission } from "@/lib/admin-access";
import { adminActionErrorMessages } from "@/lib/admin-action-errors";
import { canManageMattermostSenders } from "@/lib/mattermost-senders/access";
import { canAdmin } from "@/lib/admin-permissions";
import { mattermostSenderRepository } from "@/lib/mattermost-senders/repository";
import { listCohortCardThemes } from "@/lib/cohort-card-themes.server";
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

async function AdminCycleContent({
  session,
  params,
}: {
  session: Awaited<ReturnType<typeof requireAdminPermission>>;
  params: {
    status?: string;
    error?: string;
    generation?: string;
  };
}) {
  const canManageSenders = canManageMattermostSenders(session.account, "read");
  const canUpdate = canAdmin(session.account.permissions, "cycles", "update");
  const canDelete = canAdmin(session.account.permissions, "cycles", "delete");
  let settings: Awaited<ReturnType<typeof getSsafyCycleSettings>>;
  let themes: Awaited<ReturnType<typeof listCohortCardThemes>>;
  let senderResult: {
    senders: Awaited<ReturnType<typeof mattermostSenderRepository.listMetadata>>;
    loadError: boolean;
  };

  try {
    [settings, themes, senderResult] = await Promise.all([
      getSsafyCycleSettings(),
      listCohortCardThemes(),
      canManageSenders
        ? mattermostSenderRepository
            .listMetadata()
            .then((senders) => ({ senders, loadError: false }))
            .catch(() => ({ senders: [], loadError: true }))
        : Promise.resolve({ senders: [], loadError: false }),
    ]);
  } catch {
    return (
      <div className="grid min-w-0 gap-6">
        <AdminStatePanel
          kind="error"
          title="기수 설정을 불러오지 못했습니다."
          description="잠시 후 다시 확인해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요."
          action={<Button href="/admin/cycle" variant="secondary">다시 확인</Button>}
        />
      </div>
    );
  }

  return (
    <AdminCycleView
        settings={settings}
        overview={getSsafyCycleOverview(settings)}
        themes={themes}
        currentSemester={getCurrentSsafySemester()}
        initialTimestamp={new Date().toISOString()}
        status={params.status}
        requestedGeneration={params.generation}
        canUpdate={canUpdate}
        canDelete={canDelete}
        canManageSenderCreate={canManageMattermostSenders(
          session.account,
          "create",
        )}
        canManageSenderUpdate={canManageMattermostSenders(
          session.account,
          "update",
        )}
        canManageSenderDelete={canManageMattermostSenders(
          session.account,
          "delete",
        )}
        errorMessage={
          params.error ? adminActionErrorMessages[params.error] : null
        }
        updateSettingsAction={updateSsafyCycleSettings}
        earlyStartAction={earlyStartSsafyCycle}
        restoreAction={restoreSsafyCycleSettings}
        upsertThemeAction={upsertCohortCardTheme}
        deleteThemeAction={deleteCohortCardTheme}
        mattermostSenders={canManageSenders ? senderResult.senders : undefined}
        mattermostSenderLoadError={
          canManageSenders ? senderResult.loadError : undefined
        }
        saveMattermostSenderAction={
          canManageSenders ? saveMattermostSenderCandidate : undefined
        }
        testMattermostSenderAction={
          canManageSenders ? testMattermostSenderCandidate : undefined
        }
        disableMattermostSenderAction={
          canManageSenders ? disableMattermostSender : undefined
        }
        showHeader={false}
    />
  );
}

export default async function AdminCyclePage({
  searchParams,
}: {
  searchParams?: Promise<{
    status?: string;
    error?: string;
    generation?: string;
  }>;
}) {
  const session = await requireAdminPermission("cycles", "read", {
    path: "/admin/cycle",
  });
  const params = (await searchParams) ?? {};

  return (
    <AdminShell title="기수 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid min-w-0 gap-6">
        <AdminPageHeader
          eyebrow="설정"
          title="기수 계산 기준 관리"
          description="기수 전환 기준, 기수별 인증 카드 색상, 카드 목업을 한 화면에서 관리합니다."
          actions={<Button href="/admin/cycle/mock" variant="secondary">전체 목업보기</Button>}
        />
        <Suspense fallback={<AdminCycleSkeletonContent showHeader={false} />}>
          <AdminCycleContent session={session} params={params} />
        </Suspense>
      </div>
    </AdminShell>
  );
}
