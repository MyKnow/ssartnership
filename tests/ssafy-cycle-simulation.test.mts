import assert from "node:assert/strict";
import test from "node:test";

const yearModulePromise = import(
  new URL("../src/lib/ssafy-year.ts", import.meta.url).href
);
const cycleModulePromise = import(
  new URL("../src/lib/ssafy-cycle-settings.ts", import.meta.url).href
);

const simulationDate = new Date("2027-07-09T00:00:00+09:00");

test("default cycle rules derive the 2027-07 state correctly", async () => {
  const {
    getCurrentSsafyYear,
    getCurrentSsafySemester,
    getSsafyMemberLifecycle,
    formatSsafyMemberLifecycleLabel,
  } = await yearModulePromise;

  assert.equal(getCurrentSsafyYear(simulationDate), 18);
  assert.equal(getCurrentSsafySemester(simulationDate), 2);
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
