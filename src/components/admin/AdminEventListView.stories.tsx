import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AdminEventListView, {
  type AdminEventListSection,
} from "./AdminEventListView";

const emptySections = ["진행 전", "진행 중", "진행 후", "비활성", "등록 필요"].map(
  (bucket) => ({ bucket, items: [] }),
) satisfies AdminEventListSection[];

const sections: AdminEventListSection[] = emptySections.map((section) =>
  section.bucket === "진행 중"
    ? {
        ...section,
        items: [
          {
            slug: "signup-reward",
            title: "싸트너십 추첨권 이벤트",
            description:
              "회원가입과 알림 설정, 리뷰 작성 조건을 완료하고 추첨권을 모으는 이벤트입니다.",
            pagePath: "/events/signup-reward",
            stateLabel: "진행 중",
            stateClassName: "border-primary bg-primary text-primary-foreground",
            periodLabel: "7월 10일 오전 09:00 - 8월 9일 오후 11:59",
            targetLabel: "게스트 · 교육생 · 수료생 · 운영진",
            conditionLabels: ["회원가입 · 1장", "리뷰 작성 · 2장"],
            isRegistered: true,
          },
        ],
      }
    : section,
);

const meta = {
  title: "Domains/Admin/AdminEventListView",
  component: AdminEventListView,
  args: { sections, statusMessage: null },
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminEventListView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
