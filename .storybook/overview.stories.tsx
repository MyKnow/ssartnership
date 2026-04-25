import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

function StorybookOverview() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-2">
        <Badge variant="primary" className="w-fit">
          SSAFY Partnership UI
        </Badge>
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-foreground">
          Storybook Workspace
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          공용 UI primitives와 실제 도메인 컴포넌트를 같은 미리보기 환경에서 확인합니다.
          App Router, Tailwind v4, light/dark 토글, 상호작용 상태를 함께 검증하는 목적입니다.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card padding="md" className="grid gap-3">
          <p className="text-sm font-semibold text-foreground">Foundations</p>
          <p className="text-sm text-muted-foreground">
            색상 토큰, 라운드, 그림자, 여백, 배경 위계를 기준으로 공용 컴포넌트를 정리합니다.
          </p>
        </Card>
        <Card padding="md" className="grid gap-3">
          <p className="text-sm font-semibold text-foreground">UI Primitives</p>
          <p className="text-sm text-muted-foreground">
            Button, Card, Input, Select, Tabs 같은 재사용 표면을 먼저 확인합니다.
          </p>
        </Card>
        <Card padding="md" className="grid gap-3">
          <p className="text-sm font-semibold text-foreground">Domain Components</p>
          <p className="text-sm text-muted-foreground">
            파트너 리뷰 카드처럼 실제 서비스 문맥이 있는 컴포넌트를 함께 렌더링합니다.
          </p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary">Primary Action</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="soft">Soft</Button>
      </div>
    </div>
  );
}

const meta = {
  title: "Foundations/Overview",
  component: StorybookOverview,
  parameters: {
    docs: {
      description: {
        component:
          "이 Storybook은 공용 UI와 실제 도메인 컴포넌트를 함께 다루는 내부 작업 공간입니다.",
      },
    },
  },
} satisfies Meta<typeof StorybookOverview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Workspace: Story = {};
