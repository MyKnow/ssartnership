import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import Card from "@/components/ui/Card";
import GraduateProfilePhotoForm from "./GraduateProfilePhotoForm";

const meta = {
  title: "Screens/Member/GraduateProfilePhotoForm",
  component: GraduateProfilePhotoForm,
  parameters: {
    nextjs: { appDirectory: true },
    chromatic: { viewports: [360, 430, 820, 1366] },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-2xl p-3 sm:p-6">
        <Card>
          <Story />
        </Card>
      </div>
    ),
  ],
} satisfies Meta<typeof GraduateProfilePhotoForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const selectButton = canvas.getByRole("button", {
      name: "본인 사진 선택",
    });
    const actionGroup = selectButton.parentElement;

    await expect(
      canvas.getByText("새 사진은 관리자 적합성 검토 후 인증 카드에 반영됩니다.", {
        selector: "p",
      }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(
        "단체사진·로고·캐릭터·얼굴이 과도하게 가려진 사진은 사용할 수 없습니다.",
        { selector: "p" },
      ),
    ).toBeInTheDocument();
    await expect(actionGroup).not.toBeNull();
    await expect(actionGroup!).toHaveClass(
      "grid",
      "w-full",
      "min-[400px]:grid-cols-2",
      "min-[620px]:w-auto",
      "min-[620px]:flex",
      "min-[620px]:justify-end",
    );
  },
};

export const GalleryFormatGuard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');

    await expect(input).not.toBeNull();
    await expect(input?.accept).toContain("image/heic");
    await expect(input?.accept).toContain("image/heif");
    await expect(input?.accept).toContain("image/avif");
    await expect(input?.accept).toContain("image/svg+xml");
    await expect(input?.accept).not.toContain("image/*");

    await userEvent.upload(
      input!,
      new File(["not-an-image"], "profile.txt", { type: "text/plain" }),
      { applyAccept: false },
    );
    await expect(
      canvas.getByText("지원하는 이미지 파일만 업로드할 수 있습니다."),
    ).toBeInTheDocument();
  },
};

export const SelectedPhoto: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    const response = await fetch("/icon-512.png");
    const photo = new File([await response.blob()], "profile.png", { type: "image/png" });

    await expect(response.ok).toBe(true);
    await expect(input).not.toBeNull();
    await userEvent.upload(input!, photo);
    await expect(body.getByText("이미지 편집", { exact: true })).toBeInTheDocument();
    await waitFor(() => {
      expect(body.getByTestId("image-crop-frame")).toBeVisible();
    });
    await expect(body.queryByText("결과 미리보기")).not.toBeInTheDocument();
    await expect(canvasElement.ownerDocument.querySelector('input[type="range"]')).toBeNull();
    await expect(body.queryByTestId("image-crop-tools")).not.toBeInTheDocument();
    await expect(body.queryByRole("button", { name: "초기화" })).not.toBeInTheDocument();
    await expect(body.queryByRole("button", { name: "이미지 변경" })).not.toBeInTheDocument();
    await userEvent.click(body.getByRole("button", { name: /^적용$/ }));

    const selectedPhotoLabel = await canvas.findByText("선택한 사진", { selector: "p" });
    await expect(selectedPhotoLabel).toHaveClass("whitespace-nowrap");
    await expect(selectedPhotoLabel.parentElement).not.toBeNull();
    await expect(selectedPhotoLabel.parentElement!).toHaveClass("min-[620px]:min-w-20");
    await expect(canvas.getByText("WebP 변환 완료")).toBeInTheDocument();
    await expect(
      canvas.getByText("640×640 WebP 파일로 제출됩니다. 원본 사진은 업로드되지 않습니다."),
    ).toBeInTheDocument();
  },
};
