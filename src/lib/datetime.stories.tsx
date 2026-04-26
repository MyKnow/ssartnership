import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  formatKoreanDate,
  formatKoreanDateTime,
  formatKoreanDateTimeLocalValue,
  formatKoreanDateTimeToMinute,
  formatKoreanDateTimeToSecond,
  parseKoreanDateTimeLocalValue,
  toIsoFromKoreanDateTimeLocalValue,
} from "./datetime";

function DateTimePreview() {
  const value = "2026-04-25T12:34:56.000Z";
  const localParsed = parseKoreanDateTimeLocalValue("2026-04-25T21:34");
  const invalidParsed = parseKoreanDateTimeLocalValue("invalid");

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>date:{formatKoreanDate(value)}</div>
      <div>minute:{formatKoreanDateTimeToMinute(value)}</div>
      <div>second:{formatKoreanDateTimeToSecond(value)}</div>
      <div>
        custom:
        {formatKoreanDateTime(value, { month: "2-digit", day: "2-digit" })}
      </div>
      <div>invalid:{formatKoreanDate("invalid")}</div>
      <div>local-value:{formatKoreanDateTimeLocalValue(value)}</div>
      <div>parse-local:{localParsed?.toISOString() ?? "null"}</div>
      <div>parse-invalid:{String(invalidParsed)}</div>
      <div>to-iso-local:{toIsoFromKoreanDateTimeLocalValue("2026-04-25T21:34")}</div>
      <div>to-iso-fallback:{toIsoFromKoreanDateTimeLocalValue("2026-04-25T12:34:56.000Z")}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/DateTime",
  component: DateTimePreview,
} satisfies Meta<typeof DateTimePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("date:2026. 4. 25.")).toBeInTheDocument();
    await expect(canvas.getByText("minute:2026. 4. 25. 21:34")).toBeInTheDocument();
    await expect(canvas.getByText("second:2026. 4. 25. 21:34:56")).toBeInTheDocument();
    await expect(canvas.getByText("custom:04. 25.")).toBeInTheDocument();
    await expect(canvas.getByText(/^invalid:/)).toBeInTheDocument();
    await expect(canvas.getByText("local-value:2026-04-25T21:34")).toBeInTheDocument();
    await expect(canvas.getByText("parse-local:2026-04-25T12:34:00.000Z")).toBeInTheDocument();
    await expect(canvas.getByText("parse-invalid:null")).toBeInTheDocument();
    await expect(canvas.getByText("to-iso-local:2026-04-25T12:34:00.000Z")).toBeInTheDocument();
    await expect(canvas.getByText("to-iso-fallback:2026-04-25T12:34:56.000Z")).toBeInTheDocument();
  },
};
