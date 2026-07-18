import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import AdminMemberManualAddPanel from "./AdminMemberManualAddPanel";

const meta = {
  title: "Screens/Admin/ManualMemberImport",
  component: AdminMemberManualAddPanel,
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 820, 1366] },
  },
} satisfies Meta<typeof AdminMemberManualAddPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RowsReady: Story = {
  args: {
    initialRows: [
      {
        rowNumber: 2,
        generation: "15",
        name: "홍길동",
        campus: "서울",
        mmId: "hong.gildong",
        email: "hong@example.com",
        photoFilename: "hong.webp",
      },
      {
        rowNumber: 3,
        generation: "16",
        name: "김싸피",
        campus: "서울",
        mmId: "",
        email: "kim@example.com",
        photoFilename: "",
      },
    ],
  },
};

export const AddsAndRemovesRow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "행 추가" }));
    await expect(canvas.getByText("1번째 회원")).toBeVisible();
    await expect(canvas.getByText("MM ID 또는 이메일 중 하나는 필수입니다.")).toBeVisible();
    await expect(canvas.getByText("사진 (선택 사항)")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "생성 시작" })).toBeDisabled();
    await expect(canvas.getByRole("combobox", { name: "2행 기수" })).toBeVisible();
    await expect(canvas.getByRole("combobox", { name: "2행 캠퍼스" })).toBeVisible();
    const photoInput = canvas.getByLabelText("2행 사진 선택");
    await expect(photoInput).toBeVisible();
    const response = await fetch("/icon-512.png");
    const photo = new File([await response.blob()], "profile.png", { type: "image/png" });
    await expect(response.ok).toBe(true);
    await userEvent.upload(
      photoInput,
      photo,
    );
    await expect(body.getByText("이미지 편집", { exact: true })).toBeVisible();
    await waitFor(() => {
      expect(body.getByTestId("image-crop-frame")).toBeVisible();
    });
    await expect(body.queryByText("결과 미리보기")).not.toBeInTheDocument();
    await expect(canvasElement.ownerDocument.querySelector('input[type="range"]')).toBeNull();
    await expect(body.queryByTestId("image-crop-tools")).not.toBeInTheDocument();
    await expect(body.queryByRole("button", { name: "초기화" })).not.toBeInTheDocument();
    await expect(body.queryByRole("button", { name: "이미지 변경" })).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: /^적용$/ }));
    await expect(await canvas.findByText("선택됨 · profile.png")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "사진 해제" }));
    await expect(canvas.getByText(/JPEG·PNG·WebP·AVIF·HEIC\/HEIF·GIF·BMP·TIFF·SVG/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "행 삭제" }));
    await expect(canvas.getByText(/행 추가를 누르거나 회원 XLSX를 업로드/)).toBeVisible();
  },
};

export const RowsReadyRequiresVerification: Story = {
  args: {
    initialRows: [
      {
        rowNumber: 2,
        generation: "16",
        name: "김싸피",
        campus: "서울",
        mmId: "",
        email: "kim@example.com",
        photoFilename: "",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "생성 시작" })).toBeDisabled();
  },
};

export const RetriesFailedRows: Story = {
  args: {
    initialRows: [
      {
        rowNumber: 2,
        generation: "16",
        name: "김싸피",
        campus: "서울",
        mmId: "",
        email: "kim@example.com",
        photoFilename: "",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    let commitAttempts = 0;
    window.fetch = async (input) => {
      const url = String(input);
      if (url === "/api/admin/member-imports") {
        return Response.json({
          ok: true,
          batchId: "batch-1",
          expiresAt: "2026-07-15T00:00:00.000Z",
          uploads: [],
        });
      }
      if (url === "/api/admin/member-imports/batch-1/commit") {
        commitAttempts += 1;
        return Response.json({
          ok: true,
          result: commitAttempts === 1
            ? {
              batchId: "batch-1",
              total: 1,
              success: 0,
              failed: 1,
              retryableFailures: 1,
              items: [{
                rowNumber: 2,
                status: "failed",
                name: "김싸피",
                mmId: null,
                email: "kim@example.com",
                deliveryChannel: null,
                reason: "이메일 알림에 실패했습니다.",
                retryable: true,
              }],
            }
            : {
              batchId: "batch-1",
              total: 1,
              success: 1,
              failed: 0,
              retryableFailures: 0,
              items: [{
                rowNumber: 2,
                status: "success",
                name: "김싸피",
                mmId: null,
                email: "kim@example.com",
                deliveryChannel: "email",
                reason: null,
                retryable: false,
              }],
            },
        });
      }
      return Response.json({ message: `Unhandled story fetch: ${url}` }, { status: 500 });
    };
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "검증 및 업로드" }));
    await expect(await canvas.findByRole("button", { name: "생성 시작" })).toBeEnabled();
    await userEvent.click(canvas.getByRole("button", { name: "생성 시작" }));
    await expect(await canvas.findByRole("button", { name: "실패 행 재시도" })).toBeEnabled();
    await expect(canvas.getByText(/같은 준비 배치에서 실패 행만 다시 시도/)).toBeVisible();

    await userEvent.click(canvas.getByRole("button", { name: "실패 행 재시도" }));
    await expect(await canvas.findByText("성공 1")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "실패 행 재시도" })).not.toBeInTheDocument();
    await expect(commitAttempts).toBe(2);
  },
};

export const StopsRetryWhenDeliveryOutcomeIsUnknown: Story = {
  args: {
    canReissueManualSetup: true,
    initialRows: [
      {
        rowNumber: 2,
        generation: "16",
        name: "김싸피",
        campus: "서울",
        mmId: "",
        email: "kim@example.com",
        photoFilename: "",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    window.fetch = async (input) => {
      const url = String(input);
      if (url === "/api/admin/member-imports") {
        return Response.json({
          ok: true,
          batchId: "batch-unknown-delivery",
          expiresAt: "2026-07-15T00:00:00.000Z",
          uploads: [],
        });
      }
      if (url === "/api/admin/member-imports/batch-unknown-delivery/commit") {
        return Response.json({
          ok: true,
          result: {
            batchId: "batch-unknown-delivery",
            total: 1,
            success: 0,
            failed: 1,
            retryableFailures: 0,
            items: [{
              rowNumber: 2,
              status: "failed",
              name: "김싸피",
              mmId: null,
              email: "kim@example.com",
              deliveryChannel: "email",
              reason: "설정 링크 전송 결과를 확인해야 하므로 자동 재시도할 수 없습니다.",
              retryable: false,
            }],
          },
        });
      }
      if (url === "/api/admin/member-imports/batch-unknown-delivery/rows/2/reissue-setup") {
        return Response.json({
          ok: true,
          item: {
            rowNumber: 2,
            status: "success",
            name: "김싸피",
            mmId: null,
            email: "kim@example.com",
            deliveryChannel: "email",
            reason: null,
            retryable: false,
          },
        });
      }
      return Response.json({ message: `Unhandled story fetch: ${url}` }, { status: 500 });
    };
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "검증 및 업로드" }));
    await userEvent.click(await canvas.findByRole("button", { name: "생성 시작" }));
    await expect(await canvas.findByText(/전송 결과 확인이 필요한 행이 있어 자동 재시도는 중지되었습니다/)).toBeVisible();
    await expect(canvas.getByRole("button", { name: "자동 재시도 불가" })).toBeDisabled();
    await userEvent.click(canvas.getByRole("button", { name: "확인 후 새 링크 발급" }));
    await expect(canvas.getByText(/기존 미사용 링크는 무효화됩니다/)).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "새 링크 발급 확인" }));
    await expect(await canvas.findByText("성공 1")).toBeVisible();
  },
};

export const ClearsZipConnectedPhoto: Story = {
  args: {
    initialRows: [
      {
        rowNumber: 2,
        generation: "16",
        name: "김싸피",
        campus: "서울",
        mmId: "",
        email: "kim@example.com",
        photoFilename: "kim.webp",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("사진 ZIP 연결됨")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "사진 연결 해제" }));
    await expect(canvas.getByText(/JPEG·PNG·WebP·AVIF·HEIC\/HEIF·GIF·BMP·TIFF·SVG/)).toBeVisible();
  },
};

export const FocusesCampusValidationError: Story = {
  args: {
    initialRows: [
      {
        rowNumber: 2,
        generation: "16",
        name: "김싸피",
        campus: "",
        mmId: "",
        email: "kim@example.com",
        photoFilename: "",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const campus = canvas.getByRole("combobox", { name: "2행 캠퍼스" });
    await userEvent.click(canvas.getByRole("button", { name: "검증 및 업로드" }));
    await expect(canvas.getByText(/캠퍼스를 입력해 주세요/)).toBeVisible();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await expect(campus).toHaveFocus();
  },
};
