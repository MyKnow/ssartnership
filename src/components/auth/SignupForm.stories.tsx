import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { ToastProvider } from "@/components/ui/Toast";
import type { PolicyDocument, RequiredPolicyMap } from "@/lib/policy-documents";
import SignupForm from "./SignupForm";

const requiredPolicies: RequiredPolicyMap = {
  service: {
    id: "policy-service-v2",
    kind: "service",
    version: 2,
    title: "서비스 이용약관",
    summary: "회원가입과 서비스 이용 조건을 안내합니다.",
    content: "서비스 이용약관 전문",
    is_active: true,
    effective_at: "2026-04-01T00:00:00.000Z",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  },
  privacy: {
    id: "policy-privacy-v3",
    kind: "privacy",
    version: 3,
    title: "개인정보 처리방침",
    summary: "인증과 운영에 필요한 개인정보 처리 기준입니다.",
    content: "개인정보 처리방침 전문",
    is_active: true,
    effective_at: "2026-04-01T00:00:00.000Z",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
  },
};

const marketingPolicy: PolicyDocument = {
  id: "policy-marketing-v1",
  kind: "marketing",
  version: 1,
  title: "마케팅 정보 수신 동의",
  summary: "선택적으로 이벤트와 혜택 알림을 받습니다.",
  content: "마케팅 정보 수신 동의 전문",
  is_active: true,
  effective_at: "2026-04-01T00:00:00.000Z",
  created_at: "2026-04-01T00:00:00.000Z",
  updated_at: "2026-04-01T00:00:00.000Z",
};

const meta = {
  title: "Domains/Auth/SignupForm",
  component: SignupForm,
  args: {
    policies: requiredPolicies,
    marketingPolicy,
    selectableYears: [15, 14, 13],
    signupYearsText: "15기, 14기, 13기",
    defaultYear: 15,
    returnTo: "/",
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className="mx-auto max-w-2xl">
          <Story />
        </div>
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof SignupForm>;

export default meta;

type Story = StoryObj<typeof meta>;

function installSignupFetchMock() {
  const fetchMock = fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/mm/request-code") {
      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    }

    if (url === "/api/mm/verify-code") {
      return {
        ok: true,
        json: async () => ({ success: true }),
      };
    }

    return {
      ok: false,
      json: async () => ({ message: `Unhandled story fetch: ${url}` }),
    };
  }) as unknown as typeof fetch;
  globalThis.fetch = fetchMock;
  return fetchMock;
}

async function fillAuthStep(canvas: ReturnType<typeof within>) {
  await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "myknow");
  await userEvent.click(canvas.getByRole("button", { name: /인증번호 요청/ }));
  await expect(await canvas.findByPlaceholderText("MM DM으로 받은 인증 번호")).toBeInTheDocument();
  await userEvent.type(canvas.getByPlaceholderText("MM DM으로 받은 인증 번호"), "123456");
}

async function moveToSignupStep(canvas: ReturnType<typeof within>) {
  await fillAuthStep(canvas);
  await userEvent.click(canvas.getByRole("button", { name: "다음" }));
}

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fetchMock = installSignupFetchMock();

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "myknow");
    await userEvent.click(canvas.getByRole("button", { name: "약관 동의 후 인증번호 요청" }));
    await expect(await canvas.findByPlaceholderText("MM DM으로 받은 인증 번호")).toBeInTheDocument();
    await userEvent.type(canvas.getByPlaceholderText("MM DM으로 받은 인증 번호"), "123456");
    await userEvent.click(canvas.getByRole("button", { name: "다음" }));
    await userEvent.click(canvas.getByText("랜덤 생성"));
    await userEvent.click(canvas.getByRole("button", { name: "회원가입" }));

    await expect(fetchMock).toHaveBeenCalledWith(
      "/api/mm/request-code",
      expect.objectContaining({ method: "POST" }),
    );
    await expect(fetchMock).toHaveBeenCalledWith(
      "/api/mm/verify-code",
      expect.objectContaining({ method: "POST" }),
    );
  },
};

export const RequestCooldownError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    globalThis.fetch = fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/mm/request-code") {
        return {
          ok: false,
          json: async () => ({ error: "cooldown" }),
        };
      }
      return {
        ok: false,
        json: async () => ({ error: "unhandled" }),
      };
    }) as unknown as typeof fetch;

    await userEvent.type(canvas.getByPlaceholderText("예시: myknow"), "myknow");
    await userEvent.click(canvas.getByRole("button", { name: "약관 동의 후 인증번호 요청" }));
    await expect(
      await canvas.findByText("인증 번호 요청이 너무 잦습니다. 60초 후 다시 시도해 주세요."),
    ).toBeInTheDocument();
  },
};

export const VerifyExpiredError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    globalThis.fetch = fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/mm/request-code") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url === "/api/mm/verify-code") {
        return {
          ok: false,
          json: async () => ({ error: "expired" }),
        };
      }
      return { ok: false, json: async () => ({ error: "unhandled" }) };
    }) as unknown as typeof fetch;

    await moveToSignupStep(canvas);
    await userEvent.click(canvas.getByText("랜덤 생성"));
    await userEvent.click(canvas.getByRole("button", { name: "회원가입" }));
    await expect(
      await canvas.findByText("인증 번호가 만료되었습니다. 다시 요청해 주세요."),
    ).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText("예시: myknow")).toBeInTheDocument();
  },
};

export const VerifyPolicyOutdated: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    globalThis.fetch = fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/mm/request-code") {
        return { ok: true, json: async () => ({ success: true }) };
      }
      if (url === "/api/mm/verify-code") {
        return {
          ok: false,
          json: async () => ({ error: "policy_outdated", message: "새 약관을 확인해 주세요." }),
        };
      }
      return { ok: false, json: async () => ({ error: "unhandled" }) };
    }) as unknown as typeof fetch;

    await moveToSignupStep(canvas);
    await userEvent.click(canvas.getByText("랜덤 생성"));
    await userEvent.click(canvas.getByRole("button", { name: "회원가입" }));
    await expect(await canvas.findByText("새 약관을 확인해 주세요.")).toBeInTheDocument();
  },
};

export const RandomPasswordWithoutClipboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const originalNavigator = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {},
    });

    try {
      installSignupFetchMock();
      await moveToSignupStep(canvas);
      await userEvent.click(canvas.getByText("랜덤 생성"));
      await expect(await canvas.findByText("랜덤 비밀번호를 입력했습니다.")).toBeInTheDocument();
    } finally {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: originalNavigator,
      });
    }
  },
};

export const SuccessWithoutReturnTo: Story = {
  args: {
    returnTo: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    sessionStorage.removeItem("signup:success");
    installSignupFetchMock();
    await moveToSignupStep(canvas);
    await userEvent.click(canvas.getByText("랜덤 생성"));
    await userEvent.click(canvas.getByRole("button", { name: "회원가입" }));
    await expect(sessionStorage.getItem("signup:success")).toBe("1");
  },
};

export const ResetRequestedAuth: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    installSignupFetchMock();
    await fillAuthStep(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "인증 정보 수정" }));
    await expect(canvas.queryByPlaceholderText("MM DM으로 받은 인증 번호")).not.toBeInTheDocument();
    await expect(canvas.getByPlaceholderText("예시: myknow")).toBeInTheDocument();
  },
};

export const ResetFromSignupStep: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    installSignupFetchMock();
    await moveToSignupStep(canvas);
    await expect(canvas.getByRole("button", { name: "회원가입" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "인증 정보 수정" }));
    await expect(await canvas.findByPlaceholderText("MM DM으로 받은 인증 번호")).toBeInTheDocument();
  },
};

export const VerifyValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    installSignupFetchMock();
    await moveToSignupStep(canvas);
    await userEvent.click(canvas.getByRole("button", { name: "회원가입" }));
    await expect(await canvas.findByText("사용할 비밀번호를 입력해 주세요.")).toBeInTheDocument();
  },
};

export const RequestValidationError: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.clear(canvas.getByPlaceholderText("예시: myknow"));
    await userEvent.click(canvas.getByRole("button", { name: "약관 동의 후 인증번호 요청" }));
    await expect(canvas.getByText("MM 아이디를 입력해 주세요.")).toBeInTheDocument();
  },
};

export const WithoutMarketingPolicy: Story = {
  args: {
    marketingPolicy: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkboxes = canvas.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]!);
    await userEvent.click(checkboxes[1]!);
    await expect(checkboxes).toHaveLength(2);
    await expect(canvas.queryByText("마케팅 정보 수신 동의")).not.toBeInTheDocument();
  },
};
