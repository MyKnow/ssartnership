import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "storybook/test";
import {
  AdminCertificationCardPreviewGrid,
  AdminCohortCardThemeManager,
} from "./AdminCohortCardThemeManager";
import type { CohortCardTheme } from "@/lib/cohort-card-themes";

const themes: CohortCardTheme[] = [
  {
    cohortYear: 16,
    displayName: "16기",
    backgroundFrom: "#062a3a",
    backgroundVia: "#0f3b66",
    backgroundTo: "#111827",
    accentColor: "#38bdf8",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
  },
  {
    cohortYear: 15,
    displayName: "15기",
    backgroundFrom: "#110c1f",
    backgroundVia: "#1a1430",
    backgroundTo: "#111827",
    accentColor: "#a78bfa",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
  },
  {
    cohortYear: 14,
    displayName: "14기",
    backgroundFrom: "#07120d",
    backgroundVia: "#0a1a15",
    backgroundTo: "#111827",
    accentColor: "#34d399",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
  },
];

function CohortCardThemeStory() {
  return (
    <main className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid max-w-6xl gap-6">
        <AdminCohortCardThemeManager
          themes={themes}
          suggestedYears={[16, 15, 14]}
          upsertAction={fn()}
          deleteAction={fn()}
        />
        <AdminCertificationCardPreviewGrid
          themes={themes}
          initialTimestamp="2026-07-08T09:47:38.000Z"
        />
      </div>
    </main>
  );
}

const meta = {
  title: "Page States/Admin/CycleCardThemes",
  component: CohortCardThemeStory,
} satisfies Meta<typeof CohortCardThemeStory>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FullSurface: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("기수별 카드 색상")).toBeInTheDocument();
    await expect(canvas.getByText("16기 카드 예시")).toBeInTheDocument();
    await expect(canvas.getByText("14기 수료생 카드 예시")).toBeInTheDocument();
  },
};
