import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import LegalPolicyView from "@/components/legal/LegalPolicyView";
import type { PolicyDocument } from "@/lib/policy-documents";

const policies: PolicyDocument[] = [
  {
    id: "story-policy-service-v2",
    kind: "service",
    version: 2,
    title: "서비스 이용약관",
    summary: "싸트너십 서비스 이용 조건을 안내합니다.",
    content:
      "싸트너십은 SSAFY 구성원이 제휴 혜택을 탐색하고 이용할 수 있도록 정보를 제공합니다.\n\n## 제휴 혜택 이용\n\n혜택 조건과 적용 지점은 각 제휴처 상세 화면에서 확인할 수 있습니다.",
    is_active: true,
    effective_at: "2026-07-01T00:00:00.000Z",
    created_at: "2026-06-20T00:00:00.000Z",
    updated_at: "2026-06-20T00:00:00.000Z",
  },
  {
    id: "story-policy-service-v1",
    kind: "service",
    version: 1,
    title: "서비스 이용약관",
    summary: "이전 서비스 이용 조건입니다.",
    content: "이전 버전의 서비스 이용 조건입니다.",
    is_active: false,
    effective_at: "2026-01-01T00:00:00.000Z",
    created_at: "2025-12-20T00:00:00.000Z",
    updated_at: "2025-12-20T00:00:00.000Z",
  },
];

const meta = {
  title: "Screens/Public/LegalPolicyView",
  component: LegalPolicyView,
  args: {
    kind: "service",
    policies,
    policy: policies[0],
  },
} satisfies Meta<typeof LegalPolicyView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
