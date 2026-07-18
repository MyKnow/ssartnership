import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSectionHeading from "@/components/admin/AdminSectionHeading";
import AdminCycleGenerationSelector from "@/components/admin/AdminCycleGenerationSelector";
import MattermostSenderManager from "@/components/admin/MattermostSenderManager";
import {
  AdminCertificationCardPreviewGrid,
  AdminCohortCardThemeManager,
} from "@/components/admin/cohort-card-themes/AdminCohortCardThemeManager";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import StatsRow from "@/components/ui/StatsRow";
import SubmitButton from "@/components/ui/SubmitButton";
import type { AdminFormAction } from "@/components/admin/admin-form-actions";
import type { CohortCardTheme } from "@/lib/cohort-card-themes";
import type { MattermostSenderMetadata } from "@/lib/mattermost-senders/types";
import type {
  SsafyCycleOverview,
  SsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import {
  formatSsafyMemberLifecycleLabel,
  formatSsafyYearLabel,
} from "@/lib/ssafy-year";

function statusMessage(status?: string | null) {
  if (status === "updated") return "기준값을 저장했습니다.";
  if (status === "early-started") return "조기 시작이 적용되었습니다.";
  if (status === "restored") return "자동 계산으로 복구했습니다.";
  if (status === "theme-saved") return "기수별 카드 색상을 저장했습니다.";
  if (status === "theme-deleted") return "기수별 카드 색상을 삭제했습니다.";
  if (status === "mattermost-sender-saved") return "Mattermost Sender 후보를 암호화해 저장했습니다. 테스트 DM 성공 후 활성화해 주세요.";
  if (status === "mattermost-sender-activated") return "테스트 DM이 성공해 Mattermost Sender를 활성화했습니다.";
  if (status === "mattermost-sender-disabled") return "Mattermost Sender를 비활성화하고 자격 증명을 삭제했습니다.";
  return status ? "기수 관리 작업을 완료했습니다." : null;
}

export default function AdminCycleView({
  settings,
  overview,
  themes,
  currentSemester,
  initialTimestamp,
  status,
  errorMessage,
  updateSettingsAction,
  earlyStartAction,
  restoreAction,
  upsertThemeAction,
  deleteThemeAction,
  mattermostSenders,
  mattermostSenderLoadError,
  saveMattermostSenderAction,
  testMattermostSenderAction,
  disableMattermostSenderAction,
  requestedGeneration,
}: {
  settings: SsafyCycleSettings;
  overview: SsafyCycleOverview;
  themes: CohortCardTheme[];
  currentSemester: 1 | 2;
  initialTimestamp: string;
  status?: string | null;
  errorMessage?: string | null;
  updateSettingsAction: AdminFormAction;
  earlyStartAction: AdminFormAction;
  restoreAction: AdminFormAction;
  upsertThemeAction: AdminFormAction;
  deleteThemeAction: AdminFormAction;
  mattermostSenders?: MattermostSenderMetadata[];
  mattermostSenderLoadError?: boolean;
  saveMattermostSenderAction?: AdminFormAction;
  testMattermostSenderAction?: AdminFormAction;
  disableMattermostSenderAction?: AdminFormAction;
  requestedGeneration?: string | null;
}) {
  const overrideActive = settings.manualCurrentYear !== null;
  const currentYearLabel = `${overview.currentYear}기`;
  const studentLabels = overview.studentYears.map((year) =>
    formatSsafyMemberLifecycleLabel(year),
  );
  const cardThemeYears = Array.from(
    new Set([
      overview.currentYear,
      ...overview.studentYears,
      overview.graduateThresholdYear,
    ].filter((year) => year > 0)),
  );
  const generationGroups = Array.from(
    new Set([
      0,
      ...cardThemeYears,
      ...themes.map((theme) => theme.cohortYear),
      ...(mattermostSenders ?? []).map((sender) => sender.generation),
    ]),
  ).filter((year) => year >= 0).sort((left, right) => right - left);
  const requestedGenerationNumber =
    typeof requestedGeneration === "string" && /^\d+$/.test(requestedGeneration)
      ? Number(requestedGeneration)
      : null;
  const selectedGeneration =
    requestedGenerationNumber !== null &&
    generationGroups.includes(requestedGenerationNumber)
      ? requestedGenerationNumber
      : generationGroups[0] ?? 0;

  return (
    <div className="grid gap-6">
      <AdminPageHeader eyebrow="Cycle" title="기수 계산 기준 관리" description="기수 전환 기준, 기수별 인증 카드 색상, 카드 목업을 한 화면에서 관리합니다." />
      <StatsRow
        items={[
          { label: "현재 기수", value: currentYearLabel, hint: `${currentSemester}학기 기준` },
          { label: "자동/수동", value: overrideActive ? "수동" : "자동", hint: overrideActive ? "조기 시작 적용 중" : "날짜 기준 계산" },
          { label: "교육생 범위", value: studentLabels.join(" · "), hint: "현재 활성 교육생 구간" },
        ]}
        minItemWidth="13rem"
      />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)] 2xl:items-start">
        <Card tone="elevated" className="grid gap-5">
          <AdminSectionHeading title="현재 기준과 예정 작업" description="기수 전환 기준과 현재 계산 결과를 확인합니다." />
          {errorMessage ? <FormMessage variant="error">{errorMessage}</FormMessage> : null}
          {statusMessage(status) ? <FormMessage variant="muted">{statusMessage(status)}</FormMessage> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4">
              <p className="ui-kicker">현재 계산</p>
              <p className="mt-3 text-2xl font-semibold text-foreground">{currentYearLabel} · {currentSemester}학기</p>
              <p className="mt-2 text-sm text-muted-foreground">{overrideActive ? "조기 시작 수동 기준" : "날짜 기준 자동 계산"}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4">
              <p className="ui-kicker">현재 범위</p>
              <p className="mt-3 text-sm font-semibold text-foreground">교육생 {studentLabels.join(" · ")}</p>
              <p className="mt-2 text-sm text-muted-foreground">수료생 {overview.graduateThresholdYear}기 이하 · 운영진 0기</p>
            </div>
          </div>
          <div className="grid gap-3 rounded-3xl border border-border bg-surface-inset px-4 py-4 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">작업 예정사항</p>
            <p>다음 1학기 시작: {overview.nextSemesterStartLabel}</p>
            <p>다음 2학기 / 새 기수 시작: {overview.nextCohortStartLabel}</p>
            <p>수료 전환: {overview.graduateThresholdYear}기 이하</p>
          </div>
        </Card>

        <Card tone="elevated" className="grid gap-5 2xl:sticky 2xl:top-24">
          <AdminSectionHeading title="기준값 수정" description="기준 기수와 시작 시점을 조정하고 조기 시작 또는 복구를 실행합니다." />
          <form action={updateSettingsAction} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium text-foreground">기준 기수<Input type="number" name="anchorYear" min={1} max={99} defaultValue={settings.anchorYear} /></label>
              <label className="grid gap-2 text-sm font-medium text-foreground">기준 연도<Input type="number" name="anchorCalendarYear" min={2000} max={3000} defaultValue={settings.anchorCalendarYear} /></label>
              <label className="grid gap-2 text-sm font-medium text-foreground">기준 월<Input type="number" name="anchorMonth" min={1} max={12} defaultValue={settings.anchorMonth} /></label>
            </div>
            <SubmitButton pendingText="저장 중">기준값 저장</SubmitButton>
          </form>
          <div className="grid gap-3 sm:grid-cols-2">
            <form action={earlyStartAction}><SubmitButton variant="ghost" pendingText="적용 중" className="w-full">조기 시작</SubmitButton></form>
            <form action={restoreAction}><SubmitButton variant="danger" pendingText="복구 중" className="w-full">복구</SubmitButton></form>
          </div>
          <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4">
            <p className="text-sm font-semibold text-foreground">현재 적용 상태</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={overrideActive ? "success" : "neutral"}>{overrideActive ? "조기 시작 적용 중" : "자동 계산"}</Badge>
              <Badge variant="neutral">현재 {currentYearLabel}</Badge>
              <Badge variant="neutral">{currentSemester}학기</Badge>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-8">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <AdminSectionHeading
            title="기수별 운영"
            description="기수마다 Mattermost Sender, 인증 카드 색상, 카드 목업을 한 그룹에서 관리합니다. 아래에서 한 기수씩 선택해 확인할 수 있습니다."
          />
          <AdminCycleGenerationSelector
            generations={generationGroups}
            selectedGeneration={selectedGeneration}
          />
        </div>
        <div className="grid gap-8">
          {generationGroups
            .filter((generation) => generation === selectedGeneration)
            .map((generation, index) => {
            const generationLabel = formatSsafyYearLabel(generation);
            const isStaff = generation === 0;
            const generationSenders = (mattermostSenders ?? []).filter(
              (sender) => sender.generation === generation,
            );
            const hasActiveSender = generationSenders.some(
              (sender) => sender.status === "active",
            );
            const hasTheme = themes.some((theme) => theme.cohortYear === generation);

            return (
              <section
                key={generation}
                id={`cycle-generation-${generation}`}
                aria-labelledby={`cycle-generation-${generation}-heading`}
                className="grid gap-5 border-t border-border pt-8 first:border-t-0 first:pt-0"
              >
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="ui-kicker">기수 운영 그룹</p>
                    <h3 id={`cycle-generation-${generation}-heading`} className="mt-2 text-xl font-semibold text-foreground">
                      {generationLabel} 운영
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {isStaff
                        ? "운영진 인증 카드 목업을 확인합니다. 운영진은 학생 기수별 Sender·색상 설정 대상에서 제외됩니다."
                        : `${generationLabel}의 Sender, 인증 카드 색상, 카드 목업을 한 곳에서 관리합니다.`}
                    </p>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2 lg:justify-end">
                    {mattermostSenders ? (
                      <Badge variant={hasActiveSender ? "success" : generationSenders.length > 0 ? "warning" : "neutral"}>
                        {hasActiveSender ? "Sender 활성" : generationSenders.length > 0 ? "Sender 검증 필요" : "Sender 미등록"}
                      </Badge>
                    ) : null}
                    <Badge variant={isStaff ? "neutral" : hasTheme ? "success" : "warning"}>
                      {isStaff ? "운영진 카드" : hasTheme ? "카드 색상 저장" : "기본 색상 사용"}
                    </Badge>
                  </div>
                </div>

                {!isStaff ? (
                  <div className="grid gap-5 2xl:grid-cols-2">
                    {mattermostSenders && saveMattermostSenderAction && testMattermostSenderAction && disableMattermostSenderAction ? (
                      <MattermostSenderManager
                        senders={mattermostSenders}
                        generation={generation}
                        anchorId={index === 0 ? "mattermost-sender" : undefined}
                        loadError={mattermostSenderLoadError}
                        saveAction={saveMattermostSenderAction}
                        testAction={testMattermostSenderAction}
                        disableAction={disableMattermostSenderAction}
                      />
                    ) : null}
                    <AdminCohortCardThemeManager
                      themes={themes}
                      suggestedYears={[generation]}
                      cohortYear={generation}
                      showCreateForm={false}
                      anchorId={index === 0 ? "card-theme-manager" : undefined}
                      upsertAction={upsertThemeAction}
                      deleteAction={deleteThemeAction}
                    />
                  </div>
                ) : null}

                <AdminCertificationCardPreviewGrid
                  themes={themes}
                  generation={generation}
                  anchorId={index === 0 ? "card-preview" : undefined}
                  initialTimestamp={initialTimestamp}
                />
              </section>
            );
            })}
        </div>
      </div>
    </div>
  );
}
