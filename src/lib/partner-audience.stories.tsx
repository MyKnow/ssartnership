import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  DEFAULT_PARTNER_AUDIENCE,
  getPartnerAudienceLabel,
  isFullPartnerAudience,
  isPartnerAudienceKey,
  normalizePartnerAudience,
  parsePartnerAudienceSelection,
  PARTNER_AUDIENCE_FILTER_OPTIONS,
  PARTNER_AUDIENCE_OPTIONS,
} from "./partner-audience";

function PartnerAudiencePreview() {
  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>options:{PARTNER_AUDIENCE_OPTIONS.length}</div>
      <div>filter-options:{PARTNER_AUDIENCE_FILTER_OPTIONS.length}</div>
      <div>default:{DEFAULT_PARTNER_AUDIENCE.join(",")}</div>
      <div>is-staff:{String(isPartnerAudienceKey("staff"))}</div>
      <div>is-other:{String(isPartnerAudienceKey("other"))}</div>
      <div>normalize-empty:{normalizePartnerAudience().join(",")}</div>
      <div>normalize-mixed:{normalizePartnerAudience([" graduate ", "staff", "bad", null]).join(",")}</div>
      <div>parse-empty:{String(parsePartnerAudienceSelection([]))}</div>
      <div>parse-invalid-type:{String(parsePartnerAudienceSelection(["staff", null]))}</div>
      <div>parse-invalid-value:{String(parsePartnerAudienceSelection(["staff", "bad"]))}</div>
      <div>parse-valid:{parsePartnerAudienceSelection(["graduate", "staff"])?.join(",")}</div>
      <div>is-full-default:{String(isFullPartnerAudience(DEFAULT_PARTNER_AUDIENCE))}</div>
      <div>is-full-partial:{String(isFullPartnerAudience(["staff"]))}</div>
      <div>label-staff:{getPartnerAudienceLabel("staff")}</div>
      <div>label-student:{getPartnerAudienceLabel("student")}</div>
      <div>label-graduate:{getPartnerAudienceLabel("graduate")}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/PartnerAudience",
  component: PartnerAudiencePreview,
} satisfies Meta<typeof PartnerAudiencePreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("options:3")).toBeInTheDocument();
    await expect(canvas.getByText("filter-options:4")).toBeInTheDocument();
    await expect(canvas.getByText("default:staff,student,graduate")).toBeInTheDocument();
    await expect(canvas.getByText("is-staff:true")).toBeInTheDocument();
    await expect(canvas.getByText("is-other:false")).toBeInTheDocument();
    await expect(canvas.getByText("normalize-empty:staff,student,graduate")).toBeInTheDocument();
    await expect(canvas.getByText("normalize-mixed:staff,graduate")).toBeInTheDocument();
    await expect(canvas.getByText("parse-empty:null")).toBeInTheDocument();
    await expect(canvas.getByText("parse-invalid-type:null")).toBeInTheDocument();
    await expect(canvas.getByText("parse-invalid-value:null")).toBeInTheDocument();
    await expect(canvas.getByText("parse-valid:staff,graduate")).toBeInTheDocument();
    await expect(canvas.getByText("is-full-default:true")).toBeInTheDocument();
    await expect(canvas.getByText("is-full-partial:false")).toBeInTheDocument();
    await expect(canvas.getByText("label-staff:운영진")).toBeInTheDocument();
    await expect(canvas.getByText("label-student:교육생")).toBeInTheDocument();
    await expect(canvas.getByText("label-graduate:수료생")).toBeInTheDocument();
  },
};
