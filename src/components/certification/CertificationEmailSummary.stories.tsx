import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CertificationEmailSummary from "@/components/certification/CertificationEmailSummary";
import { CertificationSettingsGroup } from "@/components/certification/CertificationSettingsList";

function CertificationEmailSummaryStory({
  email,
  emailVerified,
  returnTo,
}: {
  email?: string | null;
  emailVerified?: boolean;
  returnTo: string;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl p-4">
      <CertificationSettingsGroup title="연결 정보">
        <CertificationEmailSummary
          email={email}
          emailVerified={emailVerified}
          returnTo={returnTo}
        />
      </CertificationSettingsGroup>
    </div>
  );
}

const meta = {
  title: "Components/Certification/EmailSummary",
  component: CertificationEmailSummaryStory,
  args: {
    email: null,
    emailVerified: false,
    returnTo: "/certification",
  },
} satisfies Meta<typeof CertificationEmailSummaryStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unverified: Story = {};

export const UnverifiedWithEmail: Story = {
  args: {
    email: "member@example.com",
  },
};

export const Verified: Story = {
  args: {
    email: "member@example.com",
    emailVerified: true,
  },
};
