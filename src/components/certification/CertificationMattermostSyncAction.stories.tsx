import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CertificationMattermostSyncAction from "@/components/certification/CertificationMattermostSyncAction";
import { ToastProvider } from "@/components/ui/Toast";

function CertificationMattermostSyncActionStory() {
  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <ToastProvider>
        <CertificationMattermostSyncAction />
      </ToastProvider>
    </div>
  );
}

const meta = {
  title: "Components/Certification/MattermostProfileSyncAction",
  component: CertificationMattermostSyncActionStory,
  parameters: { viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof CertificationMattermostSyncActionStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
