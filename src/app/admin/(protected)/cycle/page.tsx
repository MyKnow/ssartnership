import type { Metadata } from "next";
import AdminShell from "@/components/admin/AdminShell";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import SectionHeading from "@/components/ui/SectionHeading";
import SubmitButton from "@/components/ui/SubmitButton";
import {
  earlyStartSsafyCycle,
  restoreSsafyCycleSettings,
  updateSsafyCycleSettings,
} from "@/app/admin/(protected)/actions";
import {
  getConfiguredCurrentSsafyYear,
  getSsafyCycleOverview,
  getSsafyCycleSettings,
} from "@/lib/ssafy-cycle-settings";
import {
  formatSsafyMemberLifecycleLabel,
  getCurrentSsafySemester,
} from "@/lib/ssafy-year";
import { SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `기수 관리 | ${SITE_NAME}`,
  robots: {
    index: false,
    follow: true,
  },
};

export default async function AdminCyclePage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const settings = await getSsafyCycleSettings();
  const overview = getSsafyCycleOverview(settings);
  const currentYear = getConfiguredCurrentSsafyYear(settings);
  const currentSemester = getCurrentSsafySemester();
  const overrideActive = settings.manualCurrentYear !== null;
  const currentYearLabel = `${overview.currentYear}기`;
  const studentLabels = overview.studentYears.map((year) =>
    formatSsafyMemberLifecycleLabel(year),
  );

  return (
    <AdminShell title="기수 관리" backHref="/admin" backLabel="관리 홈">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="grid gap-5 bg-surface-elevated shadow-md">
          <SectionHeading
            title="현재 기준과 예정 작업"
            description="기수 전환 기준과 현재 계산 결과를 확인합니다."
          />

          {params.status ? (
            <FormMessage variant="muted">
              {params.status === "updated"
                ? "기준값을 저장했습니다."
                : params.status === "early-started"
                  ? "조기 시작이 적용되었습니다."
                  : params.status === "restored"
                    ? "자동 계산으로 복구했습니다."
                    : "기수 관리 작업을 완료했습니다."}
            </FormMessage>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                현재 계산
              </p>
              <p className="mt-3 text-2xl font-semibold text-foreground">
                {currentYearLabel} · {currentSemester}학기
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {overrideActive
                  ? `조기 시작 중 · ${formatSsafyMemberLifecycleLabel(
                      settings.manualCurrentYear ?? currentYear,
                    )}`
                  : "날짜 기준 자동 계산"}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                현재 범위
              </p>
              <p className="mt-3 text-sm font-semibold text-foreground">
                교육생 {studentLabels.join(" · ")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                수료생 {overview.graduateThresholdYear}기 이하 · 운영진 0기
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface px-4 py-4">
            <p className="text-sm font-semibold text-foreground">작업 예정사항</p>
            <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-border bg-surface-muted px-4 py-3">
                다음 1학기 시작: {overview.nextSemesterStartLabel}
              </div>
              <div className="rounded-2xl border border-border bg-surface-muted px-4 py-3">
                다음 2학기 / 새 기수 시작: {overview.nextCohortStartLabel}
              </div>
              <div className="rounded-2xl border border-border bg-surface-muted px-4 py-3">
                수료 전환: {overview.graduateThresholdYear}기 이하
              </div>
            </div>
          </div>
        </Card>

        <Card className="grid gap-5 bg-surface-elevated shadow-md">
          <SectionHeading
            title="기준값 수정"
            description="기준 기수와 시작 시점을 조정하고, 조기 시작 또는 복구를 실행합니다."
          />

          <form action={updateSsafyCycleSettings} className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-2 text-sm font-medium text-foreground">
                기준 기수
                <Input
                  type="number"
                  name="anchorYear"
                  min={1}
                  max={99}
                  defaultValue={settings.anchorYear}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                기준 연도
                <Input
                  type="number"
                  name="anchorCalendarYear"
                  min={2000}
                  max={3000}
                  defaultValue={settings.anchorCalendarYear}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-foreground">
                기준 월
                <Input
                  type="number"
                  name="anchorMonth"
                  min={1}
                  max={12}
                  defaultValue={settings.anchorMonth}
                />
              </label>
            </div>

            <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4 text-sm text-muted-foreground">
              1학기 시작월은 1월, 2학기 시작월은 7월로 고정됩니다. 현재 기준은 이 앵커를
              바탕으로 계산됩니다.
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton pendingText="저장 중">기준값 저장</SubmitButton>
            </div>
          </form>

          <div className="grid gap-3 sm:grid-cols-2">
            <form action={earlyStartSsafyCycle}>
              <SubmitButton variant="ghost" pendingText="적용 중" className="w-full">
                조기 시작
              </SubmitButton>
            </form>
            <form action={restoreSsafyCycleSettings}>
              <SubmitButton variant="danger" pendingText="복구 중" className="w-full">
                복구
              </SubmitButton>
            </form>
          </div>

          <div className="rounded-2xl border border-border bg-surface-muted px-4 py-4">
            <p className="text-sm font-semibold text-foreground">현재 적용 상태</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className={overrideActive ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-surface-muted text-muted-foreground"}>
                {overrideActive ? "조기 시작 적용 중" : "자동 계산"}
              </Badge>
              <Badge className="bg-surface-muted text-muted-foreground">
                현재 {currentYearLabel}
              </Badge>
              <Badge className="bg-surface-muted text-muted-foreground">
                {currentSemester}학기
              </Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {overrideActive
                ? `저장된 수동 기준으로 현재 기수를 계산합니다.`
                : "날짜 기준으로 현재 기수를 자동 계산합니다."}
            </p>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
