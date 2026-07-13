import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CertificationEmailAction from "@/components/certification/CertificationEmailAction";
import { ToastProvider } from "@/components/ui/Toast";

function CertificationEmailActionStory({ emailVerified = false }: { emailVerified?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <ToastProvider>
        <CertificationEmailAction
          initialEmail={emailVerified ? "member@example.com" : null}
          emailVerified={emailVerified}
        />
      </ToastProvider>
    </div>
  );
}

const meta = {
  title: "Components/Certification/EmailAction",
  component: CertificationEmailActionStory,
  parameters: { viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof CertificationEmailActionStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unverified: Story = {};

export const Verified: Story = {
  args: { emailVerified: true },
};
