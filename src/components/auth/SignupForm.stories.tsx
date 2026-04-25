import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ToastProvider } from "@/components/ui/Toast";
import type { PolicyDocument, RequiredPolicyMap } from "@/lib/policy-documents";
import SignupForm from "./SignupForm";

const requiredPolicies: RequiredPolicyMap = {
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
    summary: "인증과 운영에 필요한 개인정보 처리 기준입니다.",
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
  summary: "선택적으로 이벤트와 혜택 알림을 받습니다.",
  content: "마케팅 정보 수신 동의 전문",
  is_active: true,
  effective_at: "2026-04-01T00:00:00.000Z",
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
};

const meta = {
  title: "Domains/Auth/SignupForm",
  component: SignupForm,
  args: {
    policies: requiredPolicies,
    marketingPolicy,
    selectableYears: [15, 14, 13],
    signupYearsText: "15기, 14기, 13기",
    defaultYear: 15,
    returnTo: "/",
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className="mx-auto max-w-2xl">
          <Story />
        </div>
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof SignupForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutMarketingPolicy: Story = {
  args: {
    marketingPolicy: null,
  },
};
