import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CertificationEmailSummary from "@/components/certification/CertificationEmailSummary";

const meta = {
  title: "Components/Certification/EmailSummary",
  component: CertificationEmailSummary,
  args: {
    email: null,
    emailVerified: false,
    returnTo: "/certification",
  },
} satisfies Meta<typeof CertificationEmailSummary>;

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
