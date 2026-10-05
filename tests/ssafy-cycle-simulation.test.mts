import assert from "node:assert/strict";
import test from "node:test";

const yearModulePromise = import(
  new URL("../src/lib/ssafy-year.ts", import.meta.url).href
);
const cycleModulePromise = import(
  new URL("../src/lib/ssafy-cycle-settings-core.ts", import.meta.url).href
);

const simulationDate = new Date("2027-07-09T00:00:00+09:00");

test("default cycle rules derive the 2027-07 state correctly", async () => {
  const {
    DEFAULT_SSAFY_YEAR_RULE,
    SSAFY_STAFF_YEAR,
    getBackfillableSsafyYears,
    getCurrentSsafyYear,
    getCurrentSsafySemester,
    getSelectableSsafyYears,
    getSignupSsafyYearText,
    getSignupSsafyYears,
    getSsafyMemberLifecycle,
    formatSsafyMemberLifecycleLabel,
  } = await yearModulePromise;
  const {
    getConfiguredBackfillableSsafyYears,
    getConfiguredCurrentSsafyYear,
    getConfiguredSelectableSsafyYears,
    getConfiguredSignupSsafyYearText,
    getConfiguredSignupSsafyYears,
    getSsafyCycleOverview,
    normalizeSsafyCycleSettings,
  } = await cycleModulePromise;

  const settings = normalizeSsafyCycleSettings({
    anchor_year: DEFAULT_SSAFY_YEAR_RULE.anchorYear,
    anchor_calendar_year: DEFAULT_SSAFY_YEAR_RULE.anchorCalendarYear,
    anchor_month: DEFAULT_SSAFY_YEAR_RULE.anchorMonth,
  });

  assert.equal(getCurrentSsafyYear(simulationDate), 18);
  assert.equal(getCurrentSsafySemester(simulationDate), 2);
  assert.equal(getConfiguredCurrentSsafyYear(settings, simulationDate), 18);
  assert.deepStrictEqual(
    getConfiguredSelectableSsafyYears(settings, simulationDate),
    getSelectableSsafyYears(simulationDate),
  );
  assert.deepStrictEqual(
    getConfiguredSignupSsafyYears(settings, simulationDate),
    getSignupSsafyYears(simulationDate),
  );
  assert.equal(
    getConfiguredSignupSsafyYearText(settings, simulationDate),
    getSignupSsafyYearText(simulationDate),
  );
  assert.deepStrictEqual(
    getConfiguredBackfillableSsafyYears(settings, simulationDate),
    getBackfillableSsafyYears(simulationDate),
  );

  const overview = getSsafyCycleOverview(settings, simulationDate);
  assert.equal(overview.currentYear, getCurrentSsafyYear(simulationDate));
  assert.equal(overview.currentSemester, getCurrentSsafySemester(simulationDate));
  assert.deepStrictEqual(overview.studentYears, getSelectableSsafyYears(simulationDate));
  assert.equal(overview.staffYear, SSAFY_STAFF_YEAR);
  assert.equal(overview.graduateThresholdYear, getCurrentSsafyYear(simulationDate) - 2);
  assert.equal(overview.nextSemesterStartLabel, "2028년 1월 1일");
  assert.equal(overview.nextCohortStartLabel, "2028년 7월 1일");

  assert.deepStrictEqual(getSsafyMemberLifecycle(18, simulationDate), {
    kind: "student",
    currentYear: 18,
    semester: 1,
    label: "18기 · 1학기",
  });
  assert.deepStrictEqual(getSsafyMemberLifecycle(17, simulationDate), {
    kind: "student",
    currentYear: 18,
    semester: 2,
    label: "17기 · 2학기",
  });
  assert.deepStrictEqual(getSsafyMemberLifecycle(16, simulationDate), {
    kind: "graduate",
    currentYear: 18,
    semester: null,
    label: "16기 · 수료생",
  });
  assert.deepStrictEqual(getSsafyMemberLifecycle(0, simulationDate), {
    kind: "staff",
    currentYear: 18,
    semester: null,
    label: "운영진",
  });
  assert.equal(formatSsafyMemberLifecycleLabel(16, simulationDate), "16기 · 수료생");
});

test("configured cycle settings follow early-start overrides", async () => {
  const {
    getConfiguredCurrentSsafyYear,
    getConfiguredSelectableSsafyYears,
    getConfiguredSignupSsafyYears,
    getConfiguredBackfillableSsafyYears,
    getSsafyCycleOverview,
    normalizeSsafyCycleSettings,
  } = await cycleModulePromise;

  const settings = normalizeSsafyCycleSettings({
    anchor_year: 14,
    anchor_calendar_year: 2025,
    anchor_month: 7,
    manual_current_year: 19,
    manual_reason: "early_start",
    manual_applied_at: "2027-07-01T00:00:00.000Z",
  });

  assert.equal(getConfiguredCurrentSsafyYear(settings, simulationDate), 19);
  assert.deepStrictEqual(getConfiguredSelectableSsafyYears(settings, simulationDate), [
    18,
    19,
  ]);
  assert.deepStrictEqual(getConfiguredSignupSsafyYears(settings, simulationDate), [
    18,
    19,
    0,
  ]);
  assert.deepStrictEqual(getConfiguredBackfillableSsafyYears(settings, simulationDate), [
    0,
    18,
    19,
  ]);

  const overview = getSsafyCycleOverview(settings, simulationDate);
  assert.equal(overview.currentYear, 19);
  assert.equal(overview.currentSemester, 2);
  assert.deepStrictEqual(overview.studentYears, [18, 19]);
  assert.equal(overview.graduateThresholdYear, 17);
  assert.equal(overview.nextSemesterStartLabel, "2028년 1월 1일");
  assert.equal(overview.nextCohortStartLabel, "2028년 7월 1일");
});

test("조기 시작 대상 기수는 기존 수동 기준이 아니라 달력 기수에서 계산해 누적되지 않는다", async () => {
  const {
    getSsafyCycleEarlyStartTargetYear,
    isSsafyCycleEarlyStartApplied,
    normalizeSsafyCycleSettings,
  } = await cycleModulePromise;
  const now = new Date("2027-06-20T00:00:00+09:00");

  const automatic = normalizeSsafyCycleSettings({
    anchor_year: 14,
    anchor_calendar_year: 2025,
    anchor_month: 7,
  });
  assert.equal(getSsafyCycleEarlyStartTargetYear(automatic, now), 18);
  assert.equal(isSsafyCycleEarlyStartApplied(automatic, now), false);

  const earlyStarted = normalizeSsafyCycleSettings({
    anchor_year: 14,
    anchor_calendar_year: 2025,
    anchor_month: 7,
    manual_current_year: 18,
    manual_reason: "early_start",
  });
  assert.equal(getSsafyCycleEarlyStartTargetYear(earlyStarted, now), 18);
  assert.equal(isSsafyCycleEarlyStartApplied(earlyStarted, now), true);

  const afterCalendarCatchUp = new Date("2027-07-02T00:00:00+09:00");
  assert.equal(getSsafyCycleEarlyStartTargetYear(earlyStarted, afterCalendarCatchUp), 19);
  assert.equal(isSsafyCycleEarlyStartApplied(earlyStarted, afterCalendarCatchUp), false);
});

test("조기 시작 액션은 달력 기준 대상 기수를 쓰고 이미 적용된 경우 다시 쓰지 않는다", async () => {
  const { readFile } = await import("node:fs/promises");
  const [action, view] = await Promise.all([
    readFile(
      new URL("../src/app/admin/(protected)/_actions/cycle-actions.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/components/admin/AdminCycleView.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(action, /const targetYear = getSsafyCycleEarlyStartTargetYear\(settings, now\);/);
  assert.match(action, /if \(isSsafyCycleEarlyStartApplied\(settings, now\)\) \{\s*redirect\("\/admin\/cycle\?status=early-start-already"\);/);
  assert.doesNotMatch(action, /const targetYear = currentYear \+ 1;/);
  assert.match(view, /disabled=\{earlyStartApplied\}/);
});
