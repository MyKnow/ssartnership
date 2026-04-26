import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";
import {
  buildSignupGuideItems,
  buildSignupYears,
  getSignupRequestErrorAction,
  getSignupVerifyErrorAction,
  validateSignupAuthNextInput,
  validateSignupRequestInput,
  validateSignupVerifyInput,
} from "./helpers";

function SignupHelpersPreview() {
  const years = buildSignupYears([15, 14]);
  const guideItems = buildSignupGuideItems("15기, 14기");

  return (
    <div className="space-y-2 text-sm text-foreground">
      <div>years:{years.join(",")}</div>
      <div>guide-count:{guideItems.length}</div>
      <div>guide-first:{guideItems[0]?.description ?? "none"}</div>
      <div>
        request-empty:
        {JSON.stringify(
          validateSignupRequestInput({
            username: "",
            year: "15",
            signupYears: years,
            signupYearsText: "15기, 14기",
            policyChecked: { service: true, privacy: true, marketing: false },
          }),
        )}
      </div>
      <div>
        request-invalid-year:
        {JSON.stringify(
          validateSignupRequestInput({
            username: "myknow",
            year: "12",
            signupYears: years,
            signupYearsText: "15기, 14기",
            policyChecked: { service: true, privacy: true, marketing: false },
          }),
        )}
      </div>
      <div>
        request-policies:
        {JSON.stringify(
          validateSignupRequestInput({
            username: "myknow",
            year: "15",
            signupYears: years,
            signupYearsText: "15기, 14기",
            policyChecked: { service: false, privacy: true, marketing: false },
          }),
        )}
      </div>
      <div>
        request-ok:
        {String(
          validateSignupRequestInput({
            username: "myknow",
            year: "15",
            signupYears: years,
            signupYearsText: "15기, 14기",
            policyChecked: { service: true, privacy: true, marketing: false },
          }),
        )}
      </div>
      <div>
        auth-next-empty:{JSON.stringify(validateSignupAuthNextInput({ code: "" }))}
      </div>
      <div>
        auth-next-ok:{String(validateSignupAuthNextInput({ code: "123456" }))}
      </div>
      <div>
        verify-invalid-username:
        {JSON.stringify(
          validateSignupVerifyInput({
            username: "bad name",
            code: "123456",
            password: "Password1!",
            passwordConfirm: "Password1!",
            policyChecked: { service: true, privacy: true, marketing: false },
          }),
        )}
      </div>
      <div>
        verify-empty-code:
        {JSON.stringify(
          validateSignupVerifyInput({
            username: "myknow",
            code: "",
            password: "Password1!",
            passwordConfirm: "Password1!",
            policyChecked: { service: true, privacy: true, marketing: false },
          }),
        )}
      </div>
      <div>
        verify-empty-password:
        {JSON.stringify(
          validateSignupVerifyInput({
            username: "myknow",
            code: "123456",
            password: "",
            passwordConfirm: "",
            policyChecked: { service: true, privacy: true, marketing: false },
          }),
        )}
      </div>
      <div>
        verify-invalid-password:
        {JSON.stringify(
          validateSignupVerifyInput({
            username: "myknow",
            code: "123456",
            password: "short",
            passwordConfirm: "short",
            policyChecked: { service: true, privacy: true, marketing: false },
          }),
        )}
      </div>
      <div>
        verify-empty-confirm:
        {JSON.stringify(
          validateSignupVerifyInput({
            username: "myknow",
            code: "123456",
            password: "Password1!",
            passwordConfirm: "",
            policyChecked: { service: true, privacy: true, marketing: false },
          }),
        )}
      </div>
      <div>
        verify-mismatch:
        {JSON.stringify(
          validateSignupVerifyInput({
            username: "myknow",
            code: "123456",
            password: "Password1!",
            passwordConfirm: "Password2!",
            policyChecked: { service: true, privacy: true, marketing: false },
          }),
        )}
      </div>
      <div>
        verify-policies:
        {JSON.stringify(
          validateSignupVerifyInput({
            username: "myknow",
            code: "123456",
            password: "Password1!",
            passwordConfirm: "Password1!",
            policyChecked: { service: false, privacy: false, marketing: false },
          }),
        )}
      </div>
      <div>
        verify-ok:
        {String(
          validateSignupVerifyInput({
            username: "myknow",
            code: "123456",
            password: "Password1!",
            passwordConfirm: "Password1!",
            policyChecked: { service: true, privacy: true, marketing: false },
          }),
        )}
      </div>
      <div>request-error-invalid:{JSON.stringify(getSignupRequestErrorAction("invalid_username", undefined, "15기, 14기"))}</div>
      <div>request-error-year:{JSON.stringify(getSignupRequestErrorAction("invalid_year", "직접 메시지", "15기, 14기"))}</div>
      <div>request-error-blocked:{JSON.stringify(getSignupRequestErrorAction("blocked", undefined, "15기, 14기"))}</div>
      <div>request-error-cooldown:{JSON.stringify(getSignupRequestErrorAction("cooldown", undefined, "15기, 14기"))}</div>
      <div>request-error-default:{JSON.stringify(getSignupRequestErrorAction("weird", undefined, "15기, 14기"))}</div>
      <div>verify-error-password:{JSON.stringify(getSignupVerifyErrorAction("invalid_password", "직접 메시지"))}</div>
      <div>verify-error-policy:{JSON.stringify(getSignupVerifyErrorAction("policy_required", undefined))}</div>
      <div>verify-error-username:{JSON.stringify(getSignupVerifyErrorAction("invalid_username", undefined))}</div>
      <div>verify-error-expired:{JSON.stringify(getSignupVerifyErrorAction("expired", undefined))}</div>
      <div>verify-error-blocked:{JSON.stringify(getSignupVerifyErrorAction("blocked", undefined))}</div>
      <div>verify-error-outdated:{JSON.stringify(getSignupVerifyErrorAction("policy_outdated", "새 약관 확인"))}</div>
      <div>verify-error-default:{JSON.stringify(getSignupVerifyErrorAction("other", undefined))}</div>
    </div>
  );
}

const meta = {
  title: "Domains/Auth/SignupFormHelpers",
  component: SignupHelpersPreview,
} satisfies Meta<typeof SignupHelpersPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Summary: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("years:15,14,0")).toBeInTheDocument();
    await expect(canvas.getByText("guide-count:2")).toBeInTheDocument();
    await expect(canvas.getByText(/guide-first:회원가입은 현재 선택 가능한 15기, 14기만 가능합니다\./)).toBeInTheDocument();
    await expect(canvas.getByText(/request-empty:{"kind":"field","field":"username","message":"MM 아이디를 입력해 주세요\."}/)).toBeInTheDocument();
    await expect(canvas.getByText(/request-invalid-year:{"kind":"field","field":"year","message":"회원가입은 현재 선택 가능한 15기, 14기만 선택할 수 있습니다\."}/)).toBeInTheDocument();
    await expect(canvas.getByText(/request-policies:{"kind":"field","field":"policies","message":"필수 약관에 모두 동의해 주세요\."}/)).toBeInTheDocument();
    await expect(canvas.getByText("request-ok:null")).toBeInTheDocument();
    await expect(canvas.getByText(/auth-next-empty:{"kind":"field","field":"code","message":"인증 번호를 입력해 주세요\."}/)).toBeInTheDocument();
    await expect(canvas.getByText("auth-next-ok:null")).toBeInTheDocument();
    await expect(canvas.getByText(/verify-invalid-username:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-empty-code:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-empty-password:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-invalid-password:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-empty-confirm:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-mismatch:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-policies:/)).toBeInTheDocument();
    await expect(canvas.getByText("verify-ok:null")).toBeInTheDocument();
    await expect(canvas.getByText(/request-error-invalid:/)).toBeInTheDocument();
    await expect(canvas.getByText(/request-error-year:/)).toBeInTheDocument();
    await expect(canvas.getByText(/request-error-blocked:/)).toBeInTheDocument();
    await expect(canvas.getByText(/request-error-cooldown:/)).toBeInTheDocument();
    await expect(canvas.getByText(/request-error-default:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-error-password:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-error-policy:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-error-username:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-error-expired:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-error-blocked:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-error-outdated:/)).toBeInTheDocument();
    await expect(canvas.getByText(/verify-error-default:/)).toBeInTheDocument();
  },
};
