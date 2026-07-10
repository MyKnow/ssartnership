import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import CertificationView from "@/components/certification/CertificationView";
import PageHeader from "@/components/ui/PageHeader";

function CertificationScreenStory({
  displayName,
  campus,
}: {
  displayName: string;
  campus: string;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Member"
        title="내 인증"
        description="현재 계정의 인증 상태와 표시 정보를 확인합니다."
      />
      <CertificationView
        member={{
          mm_username: "story-member",
          display_name: displayName,
          year: 15,
          campus,
          avatar_url: null,
        }}
        initialTimestamp="2026-07-10T10:00:00.000+09:00"
        disableTracking
      />
    </div>
  );
}

const meta = {
  title: "Screens/Member/CertificationView",
  component: CertificationScreenStory,
  args: {
    displayName: "김싸피",
    campus: "서울",
  },
  parameters: { viewport: { defaultViewport: "mobile1" } },
} satisfies Meta<typeof CertificationScreenStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongKorean: Story = {
  args: {
    displayName: "아주 긴 이름을 가진 서울 캠퍼스 구성원",
    campus: "서울 캠퍼스 역삼 멀티캠퍼스 교육장",
  },
};
