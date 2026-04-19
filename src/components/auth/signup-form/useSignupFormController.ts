import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { focusField } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import {
  buildSignupGuideItems,
  buildSignupYears,
  getSignupRequestErrorAction,
  getSignupVerifyErrorAction,
  validateSignupAuthNextInput,
  validateSignupRequestInput,
  validateSignupVerifyInput,
} from "@/components/auth/signup-form/helpers";
import type {
  SignupErrorAction,
  SignupField,
  SignupFieldError,
  SignupFieldRefs,
  SignupFormProps,
  SignupPolicyState,
  SignupStep,
} from "@/components/auth/signup-form/types";
import { normalizeMmUsername } from "@/lib/validation";
import { parseSignupSsafyYearValue } from "@/lib/ssafy-year";
import {
  copyPasswordToClipboard,
  generateBrowserPassword,
} from "@/lib/browser-password";

export function useSignupFormController({
  policies,
  marketingPolicy,
  selectableYears,
  signupYearsText,
  defaultYear,
}: SignupFormProps) {
  const [step, setStep] = useState<SignupStep>("auth");
  const [codeRequested, setCodeRequested] = useState(false);
  const [username, setUsername] = useState("");
  const [year, setYear] = useState(() => String(defaultYear));
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [code, setCode] = useState("");
  const [policyChecked, setPolicyChecked] = useState<SignupPolicyState>({
    service: false,
    privacy: false,
    marketing: false,
  });
  const [fieldErrors, setFieldErrors] = useState<SignupFieldError>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signupYears = useMemo(() => buildSignupYears(selectableYears), [selectableYears]);
  const guideItems = useMemo(
    () => buildSignupGuideItems(signupYearsText),
    [signupYearsText],
  );

  const usernameRef = useRef<HTMLInputElement>(null);
  const yearGroupRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const servicePolicyRef = useRef<HTMLInputElement>(null);
  const refs: SignupFieldRefs = {
    usernameRef,
    yearGroupRef,
    passwordRef,
    passwordConfirmRef,
    codeRef,
    servicePolicyRef,
  };

  const { notify } = useToast();
  const router = useRouter();

  function focusSignupField(field: SignupField) {
    if (field === "username") {
      focusField(usernameRef);
      return;
    }
    if (field === "year") {
      focusField(yearGroupRef);
      return;
    }
    if (field === "password") {
      focusField(passwordRef);
      return;
    }
    if (field === "passwordConfirm") {
      focusField(passwordConfirmRef);
      return;
    }
    if (field === "code") {
      focusField(codeRef);
      return;
    }
    focusField(servicePolicyRef);
  }

  function clearFieldError(field: SignupField) {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormError(null);
  }

  function applyErrorAction(action: SignupErrorAction) {
    setFormError(null);
    if (action.kind === "field") {
      if (["username", "year", "code", "policies"].includes(action.field)) {
        setStep("auth");
      } else {
        setStep("signup");
      }
      setFieldErrors({ [action.field]: action.message });
      window.setTimeout(() => focusSignupField(action.field), 0);
      return;
    }
    setFieldErrors({});
    setFormError(action.message);
    if (action.nextStep) {
      setStep(action.nextStep);
    }
    if (action.refresh) {
      router.refresh();
    }
  }

  async function requestCode(nextPolicyChecked: SignupPolicyState = policyChecked) {
    if (pending) {
      return;
    }

    const validation = validateSignupRequestInput({
      username,
      year,
      signupYears,
      signupYearsText,
      policyChecked: nextPolicyChecked,
    });
    if (validation) {
      applyErrorAction(validation);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);

    try {
      const parsedYear = parseSignupSsafyYearValue(year);
      const response = await fetch("/api/mm/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizeMmUsername(username),
          year: parsedYear,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        applyErrorAction(
          getSignupRequestErrorAction(data.error, data.message, signupYearsText),
        );
        return;
      }

      setFieldErrors({});
      setFormError(null);
      setCode("");
      setCodeRequested(true);
      notify("인증 번호를 전송했습니다. MM DM을 확인하세요.");
      window.setTimeout(() => focusField(codeRef), 0);
    } finally {
      setPending(false);
    }
  }

  function moveToSignupStep() {
    const validation = validateSignupAuthNextInput({ code });
    if (validation) {
      applyErrorAction(validation);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setStep("signup");
    window.setTimeout(() => focusField(passwordRef), 0);
  }

  async function generatePassword() {
    if (pending) {
      return;
    }
    const nextPassword = generateBrowserPassword(12);
    setPassword(nextPassword);
    setPasswordConfirm(nextPassword);
    setFieldErrors((prev) => ({
      ...prev,
      password: undefined,
      passwordConfirm: undefined,
    }));
    setFormError(null);
    try {
      await copyPasswordToClipboard(nextPassword);
      notify("랜덤 비밀번호를 복사했습니다.");
    } catch {
      notify("랜덤 비밀번호를 입력했습니다.");
    }
  }

  async function verifyCode() {
    if (pending) {
      return;
    }

    const validation = validateSignupVerifyInput({
      username,
      code,
      password,
      passwordConfirm,
      policyChecked,
    });
    if (validation) {
      applyErrorAction(validation);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);

    try {
      const response = await fetch("/api/mm/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizeMmUsername(username),
          code,
          password,
          autoLogin: false,
          servicePolicyId: policies.service.id,
          privacyPolicyId: policies.privacy.id,
          marketingPolicyId: marketingPolicy?.id ?? null,
          marketingPolicyChecked: policyChecked.marketing,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        applyErrorAction(getSignupVerifyErrorAction(data.error, data.message));
        return;
      }

      setFieldErrors({});
      setFormError(null);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("signup:success", "1");
      }
      router.replace("/auth/login");
    } finally {
      setPending(false);
    }
  }

  function resetToRequestStep() {
    setStep("auth");
    setCodeRequested(false);
    setCode("");
    setFieldErrors({});
    setFormError(null);
  }

  function resetToAuthStep() {
    setStep("auth");
    setFieldErrors({});
    setFormError(null);
    window.setTimeout(() => focusField(codeRef), 0);
  }

  return {
    step,
    codeRequested,
    username,
    year,
    password,
    passwordConfirm,
    code,
    policyChecked,
    fieldErrors,
    formError,
    pending,
    signupYears,
    guideItems,
    refs,
    setUsername,
    setYear,
    setPassword,
    setPasswordConfirm,
    setCode,
    setPolicyChecked,
    clearFieldError,
    requestCode,
    moveToSignupStep,
    generatePassword,
    verifyCode,
    resetToRequestStep,
    resetToAuthStep,
  };
}
