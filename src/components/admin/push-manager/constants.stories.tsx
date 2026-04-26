import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  audienceLabels,
  extractPartnerIdFromUrl,
  formatNotificationChannels,
  formatPushLogDateTime,
  getMemberLabel,
  getPushLogStatusBadgeClass,
  statusLabels,
  typeLabels,
} from "./constants";

function PushManagerConstantsPreview() {
  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>audiences:{Object.values(audienceLabels).join(",")}</div>
      <div>types:{Object.values(typeLabels).join(",")}</div>
      <div>statuses:{Object.values(statusLabels).join(",")}</div>
      <div>badge-sent:{getPushLogStatusBadgeClass("sent")}</div>
      <div>badge-partial:{getPushLogStatusBadgeClass("partial_failed")}</div>
      <div>badge-failed:{getPushLogStatusBadgeClass("failed")}</div>
      <div>badge-none:{getPushLogStatusBadgeClass("no_target")}</div>
      <div>badge-pending:{getPushLogStatusBadgeClass("pending")}</div>
      <div>date:{formatPushLogDateTime("2026-04-25T12:34:56.000Z")}</div>
      <div>channels-empty:{formatNotificationChannels([])}</div>
      <div>channels-filled:{formatNotificationChannels(["in_app", "push", "mm"])}</div>
      <div>partner-relative:{extractPartnerIdFromUrl("/partners/partner-1")}</div>
      <div>partner-absolute:{extractPartnerIdFromUrl("https://ssartnership.vercel.app/partners/partner-2")}</div>
      <div>partner-invalid:{extractPartnerIdFromUrl("not-a-partner-url")}</div>
      <div>
        member-label:
        {getMemberLabel({
          id: "member-1",
          display_name: "김싸피",
          mm_username: "ssafy15",
          year: 15,
          campus: "서울",
        })}
      </div>
      <div>
        member-label-fallback:
        {getMemberLabel({
          id: "member-2",
          display_name: null,
          mm_username: "ops15",
          year: null,
          campus: null,
        })}
      </div>
    </div>
  );
}

const meta = {
  title: "Domains/Admin/PushManagerConstants",
  component: PushManagerConstantsPreview,
} satisfies Meta<typeof PushManagerConstantsPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("audiences:전체,기수,캠퍼스,개인")).toBeInTheDocument();
    await expect(canvas.getByText("types:운영 공지,마케팅/이벤트,신규 제휴,종료 임박")).toBeInTheDocument();
    await expect(canvas.getByText("statuses:대기,발송 완료,일부 실패,발송 실패,대상 없음")).toBeInTheDocument();
    await expect(canvas.getByText("badge-sent:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300")).toBeInTheDocument();
    await expect(canvas.getByText("badge-partial:bg-amber-500/15 text-amber-700 dark:text-amber-300")).toBeInTheDocument();
    await expect(canvas.getByText("badge-failed:bg-danger/15 text-danger")).toBeInTheDocument();
    await expect(canvas.getByText("badge-none:bg-surface-muted text-muted-foreground")).toBeInTheDocument();
    await expect(canvas.getByText("badge-pending:bg-surface-muted text-muted-foreground")).toBeInTheDocument();
    await expect(canvas.getByText("date:2026. 04. 25. 21:34")).toBeInTheDocument();
    await expect(canvas.getByText("channels-empty:채널 정보 없음")).toBeInTheDocument();
    await expect(canvas.getByText("channels-filled:앱 · 푸시 · MM")).toBeInTheDocument();
    await expect(canvas.getByText("partner-relative:partner-1")).toBeInTheDocument();
    await expect(canvas.getByText("partner-absolute:partner-2")).toBeInTheDocument();
    await expect(canvas.getByText("partner-invalid:")).toBeInTheDocument();
    await expect(canvas.getByText("member-label:김싸피 (@ssafy15) · 15기 · 1학기 · 서울")).toBeInTheDocument();
    await expect(canvas.getByText("member-label-fallback:ops15 (@ops15) · 기수 미지정 · 캠퍼스 미지정")).toBeInTheDocument();
  },
};
