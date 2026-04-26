import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  DEFAULT_SSAFY_YEAR_RULE,
  formatOptionalSsafyYearLabel,
  formatSsafyMemberLifecycleLabel,
  formatSsafyYearLabel,
  getBackfillableSsafyYears,
  getCurrentSsafySemester,
  getCurrentSsafyYear,
  getEffectiveSsafyYear,
  getPreferredStaffSourceYear,
  getSelectableSsafyYears,
  getSelectableSsafyYearText,
  getSeoulDateParts,
  getSignupSsafyYears,
  getSignupSsafyYearText,
  getSsafyMemberLifecycle,
  isSelectableSsafyYear,
  isSignupSsafyYear,
  parseSignupSsafyYearValue,
  SSAFY_STAFF_YEAR,
  validateSignupSsafyYear,
} from "./ssafy-year";

function SsafyYearPreview() {
  const now = new Date("2026-08-01T00:00:00.000Z");
  const beforeSemester = new Date("2026-03-01T00:00:00.000Z");
  const lifecycleStaff = getSsafyMemberLifecycle(SSAFY_STAFF_YEAR, now);
  const lifecycleStudent = getSsafyMemberLifecycle(16, now);
  const lifecycleGraduate = getSsafyMemberLifecycle(14, now);

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>rule:{JSON.stringify(DEFAULT_SSAFY_YEAR_RULE)}</div>
      <div>seoul-parts:{JSON.stringify(getSeoulDateParts(now))}</div>
      <div>current-year:{getCurrentSsafyYear(now)}</div>
      <div>selectable:{getSelectableSsafyYears(now).join(",")}</div>
      <div>signup:{getSignupSsafyYears(now).join(",")}</div>
      <div>backfillable:{getBackfillableSsafyYears(now).join(",")}</div>
      <div>is-selectable-15:{String(isSelectableSsafyYear(15, now))}</div>
      <div>is-selectable-14:{String(isSelectableSsafyYear(14, now))}</div>
      <div>is-signup-0:{String(isSignupSsafyYear(0, now))}</div>
      <div>is-signup-13:{String(isSignupSsafyYear(13, now))}</div>
      <div>label-staff:{formatSsafyYearLabel(0)}</div>
      <div>label-year:{formatSsafyYearLabel(16)}</div>
      <div>label-optional:{formatOptionalSsafyYearLabel(undefined)}</div>
      <div>effective-staff-direct:{String(getEffectiveSsafyYear(0, 16, [14, 15]))}</div>
      <div>effective-staff-fallback:{String(getEffectiveSsafyYear(0, null, [null, 14, 15]))}</div>
      <div>effective-staff-none:{String(getEffectiveSsafyYear(0, null, [null, 0]))}</div>
      <div>effective-normal:{String(getEffectiveSsafyYear(16, 14, [15]))}</div>
      <div>preferred-15:{String(getPreferredStaffSourceYear([null, 14, 15]))}</div>
      <div>preferred-14:{String(getPreferredStaffSourceYear([null, 14]))}</div>
      <div>preferred-none:{String(getPreferredStaffSourceYear([null, 13]))}</div>
      <div>semester-second:{getCurrentSsafySemester(now)}</div>
      <div>semester-first:{getCurrentSsafySemester(beforeSemester)}</div>
      <div>lifecycle-staff:{JSON.stringify(lifecycleStaff)}</div>
      <div>lifecycle-student:{JSON.stringify(lifecycleStudent)}</div>
      <div>lifecycle-graduate:{JSON.stringify(lifecycleGraduate)}</div>
      <div>lifecycle-label:{formatSsafyMemberLifecycleLabel(16, now)}</div>
      <div>selectable-text:{getSelectableSsafyYearText(now)}</div>
      <div>signup-text:{getSignupSsafyYearText(now)}</div>
      <div>parse-empty:{String(parseSignupSsafyYearValue(""))}</div>
      <div>parse-invalid:{String(parseSignupSsafyYearValue("100"))}</div>
      <div>parse-ok:{String(parseSignupSsafyYearValue("16"))}</div>
      <div>validate-empty:{validateSignupSsafyYear("", "기수", now)}</div>
      <div>validate-out:{validateSignupSsafyYear("13", "기수", now)}</div>
      <div>validate-ok:{String(validateSignupSsafyYear("16", "기수", now))}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/SsafyYear",
  component: SsafyYearPreview,
} satisfies Meta<typeof SsafyYearPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/rule:{"anchorYear":14,"anchorCalendarYear":2025,"anchorMonth":7}/)).toBeInTheDocument();
    await expect(canvas.getByText(/seoul-parts:{"year":2026,"month":8}/)).toBeInTheDocument();
    await expect(canvas.getByText("current-year:16")).toBeInTheDocument();
    await expect(canvas.getByText("selectable:15,16")).toBeInTheDocument();
    await expect(canvas.getByText("signup:15,16,0")).toBeInTheDocument();
    await expect(canvas.getByText("backfillable:0,15,16")).toBeInTheDocument();
    await expect(canvas.getByText("is-selectable-15:true")).toBeInTheDocument();
    await expect(canvas.getByText("is-selectable-14:false")).toBeInTheDocument();
    await expect(canvas.getByText("is-signup-0:true")).toBeInTheDocument();
    await expect(canvas.getByText("is-signup-13:false")).toBeInTheDocument();
    await expect(canvas.getByText("label-staff:운영진")).toBeInTheDocument();
    await expect(canvas.getByText("label-year:16기")).toBeInTheDocument();
    await expect(canvas.getByText("label-optional:기수 미지정")).toBeInTheDocument();
    await expect(canvas.getByText("effective-staff-direct:16")).toBeInTheDocument();
    await expect(canvas.getByText("effective-staff-fallback:14")).toBeInTheDocument();
    await expect(canvas.getByText("effective-staff-none:null")).toBeInTheDocument();
    await expect(canvas.getByText("effective-normal:16")).toBeInTheDocument();
    await expect(canvas.getByText("preferred-15:15")).toBeInTheDocument();
    await expect(canvas.getByText("preferred-14:14")).toBeInTheDocument();
    await expect(canvas.getByText("preferred-none:null")).toBeInTheDocument();
    await expect(canvas.getByText("semester-second:2")).toBeInTheDocument();
    await expect(canvas.getByText("semester-first:1")).toBeInTheDocument();
    await expect(canvas.getByText(/"kind":"staff"/)).toBeInTheDocument();
    await expect(canvas.getByText(/"label":"16기 · 1학기"/)).toBeInTheDocument();
    await expect(canvas.getByText(/"label":"14기 · 수료생"/)).toBeInTheDocument();
    await expect(canvas.getByText("lifecycle-label:16기 · 1학기")).toBeInTheDocument();
    await expect(canvas.getByText("selectable-text:15기, 16기")).toBeInTheDocument();
    await expect(canvas.getByText("signup-text:15기, 16기, 운영진")).toBeInTheDocument();
    await expect(canvas.getByText("parse-empty:null")).toBeInTheDocument();
    await expect(canvas.getByText("parse-invalid:null")).toBeInTheDocument();
    await expect(canvas.getByText("parse-ok:16")).toBeInTheDocument();
    await expect(
      canvas.getByText("validate-empty:기수는 15기, 16기, 운영진 중 하나를 선택해 주세요."),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("validate-out:기수는 15기, 16기, 운영진 중 하나를 선택해 주세요."),
    ).toBeInTheDocument();
    await expect(canvas.getByText("validate-ok:null")).toBeInTheDocument();
  },
};
