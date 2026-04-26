import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  compareEndDate,
  isWithinPeriod,
  normalizePartnerLoginId,
  parseDate,
} from "./partner-utils";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function makeRelativeDate(days: number) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const shifted = new Date(kst.getTime() + days * 24 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function PartnerUtilsPreview() {
  const parsed = parseDate("2026-04-25");
  const parsedUndefined = parseDate(undefined);
  const parsedPending = parseDate("미정");
  const parsedInvalid = parseDate("2026/04/25");
  const parsedLabel = parsed
    ? `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
    : "null";

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>parse-valid:{parsedLabel}</div>
      <div>parse-undefined:{String(parsedUndefined)}</div>
      <div>parse-pending:{String(parsedPending)}</div>
      <div>parse-invalid:{String(parsedInvalid)}</div>
      <div>within-open:{String(isWithinPeriod())}</div>
      <div>within-current:{String(isWithinPeriod(makeRelativeDate(-1), makeRelativeDate(1)))}</div>
      <div>within-future:{String(isWithinPeriod(makeRelativeDate(1), makeRelativeDate(2)))}</div>
      <div>within-ended:{String(isWithinPeriod(makeRelativeDate(-3), makeRelativeDate(-1)))}</div>
      <div>within-invalid:{String(isWithinPeriod("invalid", "invalid"))}</div>
      <div>compare-both-null:{compareEndDate(null, null)}</div>
      <div>compare-left-null:{compareEndDate(null, "2026-04-25")}</div>
      <div>compare-right-null:{compareEndDate("2026-04-25", null)}</div>
      <div>compare-order:{Math.sign(compareEndDate("2026-04-25", "2026-04-26"))}</div>
      <div>normalize-login:{normalizePartnerLoginId("  Partner.Admin  ")}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/PartnerUtils",
  component: PartnerUtilsPreview,
} satisfies Meta<typeof PartnerUtilsPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("parse-valid:2026-04-25")).toBeInTheDocument();
    await expect(canvas.getByText("parse-undefined:null")).toBeInTheDocument();
    await expect(canvas.getByText("parse-pending:null")).toBeInTheDocument();
    await expect(canvas.getByText("parse-invalid:null")).toBeInTheDocument();
    await expect(canvas.getByText("within-open:true")).toBeInTheDocument();
    await expect(canvas.getByText("within-current:true")).toBeInTheDocument();
    await expect(canvas.getByText("within-future:false")).toBeInTheDocument();
    await expect(canvas.getByText("within-ended:false")).toBeInTheDocument();
    await expect(canvas.getByText("within-invalid:true")).toBeInTheDocument();
    await expect(canvas.getByText("compare-both-null:0")).toBeInTheDocument();
    await expect(canvas.getByText("compare-left-null:1")).toBeInTheDocument();
    await expect(canvas.getByText("compare-right-null:-1")).toBeInTheDocument();
    await expect(canvas.getByText("compare-order:-1")).toBeInTheDocument();
    await expect(canvas.getByText("normalize-login:partner.admin")).toBeInTheDocument();
  },
};
