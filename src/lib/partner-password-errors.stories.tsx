import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  getPartnerPortalPasswordChangeErrorMessage,
  getPartnerPortalPasswordChangeErrorStatus,
  getPartnerPortalPasswordResetErrorMessage,
  getPartnerPortalPasswordResetErrorStatus,
  PartnerPortalPasswordChangeError,
  PartnerPortalPasswordResetError,
} from "./partner-password-errors";

function PartnerPasswordErrorsPreview() {
  const resetError = new PartnerPortalPasswordResetError("not_found", "없음");
  const changeError = new PartnerPortalPasswordChangeError("wrong_password", "틀림");

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>reset-name:{resetError.name}</div>
      <div>reset-code:{resetError.code}</div>
      <div>change-name:{changeError.name}</div>
      <div>change-code:{changeError.code}</div>
      <div>reset-invalid-email:{getPartnerPortalPasswordResetErrorMessage("invalid_email")}</div>
      <div>reset-not-found:{getPartnerPortalPasswordResetErrorMessage("not_found")}</div>
      <div>reset-inactive:{getPartnerPortalPasswordResetErrorMessage("inactive_account")}</div>
      <div>reset-setup:{getPartnerPortalPasswordResetErrorMessage("setup_required")}</div>
      <div>reset-send-failed:{getPartnerPortalPasswordResetErrorMessage("send_failed")}</div>
      <div>reset-status-invalid:{getPartnerPortalPasswordResetErrorStatus("invalid_email")}</div>
      <div>reset-status-not-found:{getPartnerPortalPasswordResetErrorStatus("not_found")}</div>
      <div>reset-status-inactive:{getPartnerPortalPasswordResetErrorStatus("inactive_account")}</div>
      <div>reset-status-setup:{getPartnerPortalPasswordResetErrorStatus("setup_required")}</div>
      <div>reset-status-send-failed:{getPartnerPortalPasswordResetErrorStatus("send_failed")}</div>
      <div>change-unauthorized:{getPartnerPortalPasswordChangeErrorMessage("unauthorized")}</div>
      <div>change-wrong-password:{getPartnerPortalPasswordChangeErrorMessage("wrong_password")}</div>
      <div>change-invalid-password:{getPartnerPortalPasswordChangeErrorMessage("invalid_password")}</div>
      <div>change-status-unauthorized:{getPartnerPortalPasswordChangeErrorStatus("unauthorized")}</div>
      <div>change-status-wrong-password:{getPartnerPortalPasswordChangeErrorStatus("wrong_password")}</div>
      <div>change-status-invalid-password:{getPartnerPortalPasswordChangeErrorStatus("invalid_password")}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Lib/PartnerPasswordErrors",
  component: PartnerPasswordErrorsPreview,
} satisfies Meta<typeof PartnerPasswordErrorsPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("reset-name:PartnerPortalPasswordResetError")).toBeInTheDocument();
    await expect(canvas.getByText("reset-code:not_found")).toBeInTheDocument();
    await expect(canvas.getByText("change-name:PartnerPortalPasswordChangeError")).toBeInTheDocument();
    await expect(canvas.getByText("change-code:wrong_password")).toBeInTheDocument();
    await expect(canvas.getByText("reset-invalid-email:이메일 형식이 올바르지 않습니다.")).toBeInTheDocument();
    await expect(canvas.getByText("reset-not-found:해당 이메일로 등록된 계정을 찾을 수 없습니다.")).toBeInTheDocument();
    await expect(canvas.getByText("reset-inactive:비활성화된 계정입니다. 관리자에게 문의해 주세요.")).toBeInTheDocument();
    await expect(
      canvas.getByText("reset-setup:아직 초기 설정이 완료되지 않았습니다. 초기 설정 링크를 먼저 사용해 주세요."),
    ).toBeInTheDocument();
    await expect(canvas.getByText("reset-send-failed:임시 비밀번호 전송에 실패했습니다.")).toBeInTheDocument();
    await expect(canvas.getByText("reset-status-invalid:400")).toBeInTheDocument();
    await expect(canvas.getByText("reset-status-not-found:404")).toBeInTheDocument();
    await expect(canvas.getByText("reset-status-inactive:403")).toBeInTheDocument();
    await expect(canvas.getByText("reset-status-setup:409")).toBeInTheDocument();
    await expect(canvas.getByText("reset-status-send-failed:500")).toBeInTheDocument();
    await expect(canvas.getByText("change-unauthorized:로그인 후 다시 시도해 주세요.")).toBeInTheDocument();
    await expect(canvas.getByText("change-wrong-password:현재 비밀번호가 올바르지 않습니다.")).toBeInTheDocument();
    await expect(
      canvas.getByText("change-invalid-password:비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 모두 포함해야 합니다."),
    ).toBeInTheDocument();
    await expect(canvas.getByText("change-status-unauthorized:401")).toBeInTheDocument();
    await expect(canvas.getByText("change-status-wrong-password:400")).toBeInTheDocument();
    await expect(canvas.getByText("change-status-invalid-password:400")).toBeInTheDocument();
  },
};
