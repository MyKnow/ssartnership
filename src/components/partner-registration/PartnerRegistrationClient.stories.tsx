import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import PartnerRegistrationClient from "./PartnerRegistrationClient";
import PartnerRegistrationGuide from "./PartnerRegistrationGuide";
import {
  PARTNER_REGISTRATION_INITIAL_ACTION_STATE,
  PARTNER_REGISTRATION_INITIAL_EXCEL_ACTION_STATE,
} from "@/lib/partner-registration";

const categories = [
  { id: "category-cafe", key: "cafe", label: "카페" },
  { id: "category-food", key: "food", label: "식당" },
];
const completeInitialValues = {
  serviceMode: "offline" as const,
  benefitActionType: "external_link" as const,
  brandName: "카페 싸피 역삼본점",
  categoryLabel: "카페",
  location: "서울 강남구 테헤란로 212 1층",
  benefitActionLink: "https://cafessafy.example/coupon",
  benefits: "아메리카노 10% 할인",
  conditions: "싸트너십 인증",
  companyName: "카페 싸피",
  contactName: "김싸피",
  contactEmail: "partner@cafessafy.example",
};

async function webAction() {
  return PARTNER_REGISTRATION_INITIAL_ACTION_STATE;
}

async function excelAction() {
  return PARTNER_REGISTRATION_INITIAL_EXCEL_ACTION_STATE;
}

function PartnerRegistrationScreen(
  props: ComponentProps<typeof PartnerRegistrationClient>,
) {
  return (
    <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-5 p-3 sm:p-6 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      <PartnerRegistrationClient {...props} />
      <PartnerRegistrationGuide />
    </div>
  );
}

const meta = {
  title: "Domains/PartnerRegistration/ActualView",
  component: PartnerRegistrationScreen,
  args: {
    categories,
    webAction,
    excelAction,
  },
  parameters: {
    layout: "fullscreen",
    chromatic: { viewports: [360, 820, 1366] },
    viewport: { defaultViewport: "mobile1" },
  },
} satisfies Meta<typeof PartnerRegistrationScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WebInput: Story = {
  parameters: {
    mockScenario: {
      routePath: "/partner-registration",
      scenarioId: "public.partner.registration.web-input",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const stepSummary = canvas.getByText("1/5 제휴처");
    const firstInput = canvas.getByLabelText(/제휴처명/);
    const bulkHeading = canvas.getByRole("heading", { name: "파일로 일괄 접수" });
    const bulkButton = canvas.getByRole("button", { name: "파일 접수 열기" });

    await expect(stepSummary).toBeVisible();
    await expect(firstInput).toBeVisible();
    await expect(
      Boolean(
        firstInput.compareDocumentPosition(bulkHeading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    await expect(bulkButton).toHaveAttribute("aria-expanded", "false");
  },
};

export const ExcelDisclosure: Story = {
  parameters: {
    mockScenario: {
      routePath: "/partner-registration",
      scenarioId: "public.partner.registration.excel-upload",
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "파일 접수 열기" });
    await userEvent.click(button);
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByLabelText(/파일 업로드/)).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "업로드 및 신청 접수" }),
    );
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "XLSX 파일을 업로드해 주세요.",
    );
  },
};

export const ValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "다음 단계" }));
    await expect(canvas.getAllByRole("alert").length).toBeGreaterThan(0);
    await expect(canvas.getByLabelText(/제휴처명/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  },
};

export const ImageGallery: Story = {
  args: {
    initialValues: completeInitialValues,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "4/5 소개" }),
    );
    await expect(
      canvas.getByRole("heading", { name: "제휴처 이미지" }),
    ).toBeVisible();
  },
};

export const BrokenImage: Story = {
  args: {
    initialValues: completeInitialValues,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "4/5 소개" }));
    const input = canvasElement.querySelector<HTMLInputElement>(
      'input[type="file"]',
    );
    if (!input) {
      throw new Error("대표 이미지 파일 입력을 찾지 못했습니다.");
    }
    await userEvent.upload(
      input,
      new File(["not-an-image"], "invalid.txt", { type: "text/plain" }),
      { applyAccept: false },
    );
    await expect(
      canvas.getByText("지원하는 이미지 파일만 업로드할 수 있습니다."),
    ).toBeVisible();
  },
};

export const ActionSuccess: Story = {
  args: {
    initialWebState: {
      status: "success",
      message: "제휴처 등록 신청이 접수되었습니다.",
    },
  },
};

export const ActionError: Story = {
  args: {
    initialWebState: {
      status: "error",
      message: "등록 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    },
  },
};

export const AsyncPending: Story = {
  args: {
    initialValues: completeInitialValues,
    webAction: async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      return {
        status: "success" as const,
        message: "제휴처 등록 신청이 접수되었습니다.",
      };
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "5/5 담당자" }));
    await userEvent.click(canvas.getByRole("button", { name: "신청 접수" }));
    await expect(canvas.getByText("접수 중")).toBeVisible();
  },
};

export const LongKoreanContent: Story = {
  args: {
    initialValues: {
      brandName: "역삼역과 선릉역 사이에서 장시간 학습하는 교육생을 위한 조용한 카페 제휴처",
      categoryLabel: "스터디 카페와 디저트",
      companyName: "서울 전역 직영점을 운영하는 길고 긴 이름의 파트너사",
      contactName: "싸피 파트너십 운영 담당자",
      contactEmail: "partnership-operations@example.com",
    },
  },
};
