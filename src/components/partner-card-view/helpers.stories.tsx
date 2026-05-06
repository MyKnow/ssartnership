import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  buildPartnerCardTrackingProperties,
  createCategoryAccentStyles,
  createPartnerCardPresentation,
  withAlpha,
} from "./helpers";
import type { Partner } from "@/lib/types";

const basePartner: Partner = {
  id: "partner-1",
  name: "역삼 샐러드 바",
  category: "food",
  visibility: "public",
  createdAt: "2026-04-25T00:00:00.000Z",
  location: "전국 매장",
  mapUrl: "",
  reservationLink: "",
  inquiryLink: "https://booking.naver.com/demo",
  period: {
    start: "2026-04-01",
    end: "2026-12-31",
  },
  conditions: [],
  benefits: [],
  appliesTo: ["student"],
  thumbnail: null,
  images: ["https://example.com/image-a.webp"],
  tags: [],
};

function PartnerCardHelpersPreview() {
  const styled = createCategoryAccentStyles("#2563eb");
  const unstyled = createCategoryAccentStyles();
  const publicPresentation = createPartnerCardPresentation(basePartner, true);
  const privatePresentation = createPartnerCardPresentation(
    { ...basePartner, visibility: "private", id: "" },
    false,
  );
  const inactivePresentation = createPartnerCardPresentation(
    {
      ...basePartner,
      period: { start: "2025-01-01", end: "2025-12-31" },
    },
    true,
  );

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>with-alpha:{withAlpha("#2563eb", "1f")}</div>
      <div>with-alpha-invalid:{withAlpha("red", "1f")}</div>
      <div>badge-bg:{String(styled.badgeStyle?.backgroundColor)}</div>
      <div>chip-border:{String(styled.chipStyle?.borderColor)}</div>
      <div>unstyled:{String(unstyled.badgeStyle)}</div>
      <div>public:{JSON.stringify(publicPresentation)}</div>
      <div>private:{JSON.stringify(privatePresentation)}</div>
      <div>inactive:{JSON.stringify(inactivePresentation)}</div>
      <div>tracking:{JSON.stringify(buildPartnerCardTrackingProperties(basePartner))}</div>
    </div>
  );
}

const meta = {
  title: "Domains/PartnerCardView/Helpers",
  component: PartnerCardHelpersPreview,
} satisfies Meta<typeof PartnerCardHelpersPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("with-alpha:#2563eb1f")).toBeInTheDocument();
    await expect(canvas.getByText("with-alpha-invalid:red")).toBeInTheDocument();
    await expect(canvas.getByText("badge-bg:#2563eb1f")).toBeInTheDocument();
    await expect(canvas.getByText("chip-border:#2563eb55")).toBeInTheDocument();
    await expect(canvas.getByText("unstyled:undefined")).toBeInTheDocument();
    await expect(canvas.getByText(/public:{"lockKind":null/)).toBeInTheDocument();
    await expect(
      canvas.getByText(/public:.*"thumbnailUrl":"https:\/\/example\.com\/image-a\.webp"/),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(/public:.*"reservationAction":{"label":"혜택 이용","href":"https:\/\/booking\.naver\.com\/demo","type":"external_link"}/),
    ).toBeInTheDocument();
    await expect(canvas.getByText(/public:.*"mapLink":"https:\/\/map\.naver\.com\/p\/search\//)).toBeInTheDocument();
    await expect(canvas.getByText(/public:.*"detailHref":"\/partners\/partner-1"/)).toBeInTheDocument();
    await expect(canvas.getByText(/private:{"lockKind":"private"/)).toBeInTheDocument();
    await expect(canvas.getByText(/private:.*"detailHref":""/)).toBeInTheDocument();
    await expect(canvas.getByText(/inactive:.*"isActive":false/)).toBeInTheDocument();
    await expect(canvas.getByText(/inactive:.*"reservationAction":null/)).toBeInTheDocument();
    await expect(canvas.getByText(/tracking:{"categoryKey":"food"}/)).toBeInTheDocument();
  },
};
