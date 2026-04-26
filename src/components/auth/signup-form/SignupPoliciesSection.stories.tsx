import { useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import SignupPoliciesSection from "./SignupPoliciesSection";
import type { PolicyDocument, RequiredPolicyMap } from "@/lib/policy-documents";
import type { SignupPolicyState } from "./types";

const policies: RequiredPolicyMap = {
  service: {
    id: "policy-service-v2",
    kind: "service",
    version: 2,
    title: "서비스 이용약관",
    summary: "회원가입과 서비스 이용 조건을 안내합니다.",
    content: "서비스 이용약관 전문",
    is_active: true,
    effective_at: "2026-04-01T00:00:00.000Z",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  },
  privacy: {
    id: "policy-privacy-v3",
    kind: "privacy",
    version: 3,
    title: "개인정보 처리방침",
    summary: "개인정보 수집 및 처리 기준입니다.",
    content: "개인정보 처리방침 전문",
    is_active: true,
    effective_at: "2026-04-01T00:00:00.000Z",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  },
};

const marketingPolicy: PolicyDocument = {
  id: "policy-marketing-v1",
  kind: "marketing",
  version: 1,
  title: "마케팅 정보 수신 동의",
  summary: "혜택 안내 수신 동의입니다.",
  content: "마케팅 정보 수신 동의 전문",
  is_active: true,
  effective_at: "2026-04-01T00:00:00.000Z",
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
};

function SignupPoliciesSectionDemo({
  initialChecked = {
    service: false,
    privacy: false,
    marketing: false,
  },
  pending = false,
  error,
  withMarketingPolicy = true,
}: {
  initialChecked?: SignupPolicyState;
  pending?: boolean;
  error?: string;
  withMarketingPolicy?: boolean;
}) {
  const [checked, setChecked] = useState(initialChecked);
  const servicePolicyRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mx-auto max-w-2xl">
      <SignupPoliciesSection
        policies={policies}
        marketingPolicy={withMarketingPolicy ? marketingPolicy : null}
        policyChecked={checked}
        pending={pending}
        error={error}
        servicePolicyRef={servicePolicyRef}
        onPolicyChange={(key, value) =>
          setChecked((prev) => ({
            ...prev,
            [key]: value,
          }))
        }
      />
    </div>
  );
}

function SignupPoliciesSectionStory(props: {
  policyChecked?: SignupPolicyState;
  pending?: boolean;
  error?: string;
  marketingPolicy?: PolicyDocument | null;
}) {
  return (
    <SignupPoliciesSectionDemo
      initialChecked={props.policyChecked}
      pending={props.pending}
      error={props.error}
      withMarketingPolicy={props.marketingPolicy !== null}
    />
  );
}

const meta = {
  title: "Domains/Auth/SignupPoliciesSection",
  component: SignupPoliciesSectionStory,
  args: {
    marketingPolicy,
    policyChecked: {
      service: false,
      privacy: false,
      marketing: false,
    },
    pending: false,
  },
} satisfies Meta<typeof SignupPoliciesSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [serviceCheckbox, privacyCheckbox, marketingCheckbox] = canvas.getAllByRole("checkbox");
    await userEvent.click(serviceCheckbox);
    await userEvent.click(privacyCheckbox!);
    await userEvent.click(marketingCheckbox!);
    await expect(serviceCheckbox).toBeChecked();
    await expect(privacyCheckbox!).toBeChecked();
    await expect(marketingCheckbox!).toBeChecked();
  },
};

export const WithValidationError: Story = {
  args: {
    error: "필수 약관에 모두 동의해 주세요.",
  },
};

export const WithoutMarketingPolicy: Story = {
  args: {
    marketingPolicy: null,
  },
};

export const Pending: Story = {
  args: {
    pending: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const checkbox of canvas.getAllByRole("checkbox")) {
      await expect(checkbox).toBeDisabled();
    }
  },
};
