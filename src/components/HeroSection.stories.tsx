import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import HeroSection from "./HeroSection";

const meta = {
  title: "Domains/HeroSection",
  component: HeroSection,
  args: {
    eyebrow: "SSAFY Partnership",
    title: "서울 캠퍼스 주변 제휴 혜택을 한눈에 정리합니다.",
    description:
      "행사 운영 직전에도 핵심 메시지와 참여 동선을 빠르게 맞출 수 있도록, 메인 히어로 영역의 밀도와 문장 길이를 고정된 화면에서 점검합니다.",
    headingLevel: "h1",
  },
} satisfies Meta<typeof HeroSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "서울 캠퍼스 주변 제휴 혜택을 한눈에 정리합니다."
  }
};

export const SecondaryHeading: Story = {
  args: {
    eyebrow: "Partner Portal",
    title: "파트너 전용 운영 공지와 요청 현황을 분리해서 보여줍니다.",
    description:
      "상단 노출 면적이 큰 영역이라 제목 길이, 보조 설명 줄 수, 그리고 작은 화면 줄바꿈 안정성을 함께 확인합니다.",
    headingLevel: "h2",
  },
};
