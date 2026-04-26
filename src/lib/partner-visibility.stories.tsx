import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  canViewPartnerDetails,
  getPartnerLockCopy,
  getPartnerLockKind,
  getPartnerVisibilityBadgeClass,
  getPartnerVisibilityLabel,
  getPartnerVisibilityState,
  isPartnerVisibility,
  normalizePartnerVisibility,
} from "./partner-visibility";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function makeRelativeDate(days: number) {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const shifted = new Date(kst.getTime() + days * 24 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

function PartnerVisibilityPreview() {
  const confidentialCopy = getPartnerLockCopy("confidential");
  const privateCopy = getPartnerLockCopy("private");

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>is-public:{String(isPartnerVisibility("public"))}</div>
      <div>is-hidden:{String(isPartnerVisibility("hidden"))}</div>
      <div>normalize-empty:{normalizePartnerVisibility("")}</div>
      <div>normalize-confidential:{normalizePartnerVisibility(" Confidential ")}</div>
      <div>state-public:{getPartnerVisibilityState("public", makeRelativeDate(-1), makeRelativeDate(1))}</div>
      <div>state-expired:{getPartnerVisibilityState("confidential", makeRelativeDate(-5), makeRelativeDate(-1))}</div>
      <div>state-private:{getPartnerVisibilityState("private", makeRelativeDate(-5), makeRelativeDate(-1))}</div>
      <div>label-public:{getPartnerVisibilityLabel("public")}</div>
      <div>label-confidential:{getPartnerVisibilityLabel("confidential")}</div>
      <div>label-private:{getPartnerVisibilityLabel("private")}</div>
      <div>label-expired:{getPartnerVisibilityLabel("expired")}</div>
      <div>badge-public:{getPartnerVisibilityBadgeClass("public")}</div>
      <div>badge-confidential:{getPartnerVisibilityBadgeClass("confidential")}</div>
      <div>badge-private:{getPartnerVisibilityBadgeClass("private")}</div>
      <div>badge-expired:{getPartnerVisibilityBadgeClass("expired")}</div>
      <div>view-public:{String(canViewPartnerDetails("public", false))}</div>
      <div>view-confidential-guest:{String(canViewPartnerDetails("confidential", false))}</div>
      <div>view-confidential-member:{String(canViewPartnerDetails("confidential", true))}</div>
      <div>view-private:{String(canViewPartnerDetails("private", true))}</div>
      <div>
        view-expired:
        {String(
          canViewPartnerDetails("public", true, {
            start: makeRelativeDate(-5),
            end: makeRelativeDate(-1),
          }),
        )}
      </div>
      <div>lock-public:{String(getPartnerLockKind("public", false))}</div>
      <div>lock-confidential-guest:{String(getPartnerLockKind("confidential", false))}</div>
      <div>lock-confidential-member:{String(getPartnerLockKind("confidential", true))}</div>
      <div>lock-private:{String(getPartnerLockKind("private", true))}</div>
      <div>copy-confidential-badge:{confidentialCopy.badge}</div>
      <div>copy-confidential-title:{confidentialCopy.title}</div>
      <div>copy-private-badge:{privateCopy.badge}</div>
      <div>copy-private-title:{privateCopy.title}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/PartnerVisibility",
  component: PartnerVisibilityPreview,
} satisfies Meta<typeof PartnerVisibilityPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("is-public:true")).toBeInTheDocument();
    await expect(canvas.getByText("is-hidden:false")).toBeInTheDocument();
    await expect(canvas.getByText("normalize-empty:public")).toBeInTheDocument();
    await expect(canvas.getByText("normalize-confidential:confidential")).toBeInTheDocument();
    await expect(canvas.getByText("state-public:public")).toBeInTheDocument();
    await expect(canvas.getByText("state-expired:expired")).toBeInTheDocument();
    await expect(canvas.getByText("state-private:private")).toBeInTheDocument();
    await expect(canvas.getByText("label-public:공개")).toBeInTheDocument();
    await expect(canvas.getByText("label-confidential:대외비")).toBeInTheDocument();
    await expect(canvas.getByText("label-private:비공개")).toBeInTheDocument();
    await expect(canvas.getByText("label-expired:기간 만료")).toBeInTheDocument();
    await expect(
      canvas.getByText("badge-public:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("badge-confidential:bg-amber-500/15 text-amber-700 dark:text-amber-300"),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("badge-private:bg-slate-500/15 text-slate-700 dark:text-slate-300"),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText("badge-expired:bg-rose-500/15 text-rose-700 dark:text-rose-300"),
    ).toBeInTheDocument();
    await expect(canvas.getByText("view-public:true")).toBeInTheDocument();
    await expect(canvas.getByText("view-confidential-guest:false")).toBeInTheDocument();
    await expect(canvas.getByText("view-confidential-member:true")).toBeInTheDocument();
    await expect(canvas.getByText("view-private:false")).toBeInTheDocument();
    await expect(canvas.getByText("view-expired:false")).toBeInTheDocument();
    await expect(canvas.getByText("lock-public:null")).toBeInTheDocument();
    await expect(canvas.getByText("lock-confidential-guest:confidential")).toBeInTheDocument();
    await expect(canvas.getByText("lock-confidential-member:null")).toBeInTheDocument();
    await expect(canvas.getByText("lock-private:private")).toBeInTheDocument();
    await expect(canvas.getByText("copy-confidential-badge:대외비")).toBeInTheDocument();
    await expect(canvas.getByText("copy-confidential-title:로그인하면 확인할 수 있어요")).toBeInTheDocument();
    await expect(canvas.getByText("copy-private-badge:비공개")).toBeInTheDocument();
    await expect(canvas.getByText("copy-private-title:아직 추진 중인 제휴 업체예요")).toBeInTheDocument();
  },
};
