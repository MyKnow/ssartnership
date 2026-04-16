import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { focusField } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import {
  buildSignupGuideItems,
  buildSignupYears,
  getSignupRequestErrorAction,
  getSignupVerifyErrorAction,
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

export function useSignupFormController({
  policies,
  selectableYears,
  signupYearsText,
  defaultYear,
}: SignupFormProps) {
  const [step, setStep] = useState<SignupStep>("request");
  const [username, setUsername] = useState("");
  const [year, setYear] = useState(() => String(defaultYear));
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [policyChecked, setPolicyChecked] = useState<SignupPolicyState>({
    service: false,
    privacy: false,
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
  const codeRef = useRef<HTMLInputElement>(null);
  const servicePolicyRef = useRef<HTMLInputElement>(null);
  const refs: SignupFieldRefs = {
    usernameRef,
    yearGroupRef,
    passwordRef,
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
      setFieldErrors({ [action.field]: action.message });
      focusSignupField(action.field);
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

  async function requestCode() {
    if (pending) {
      return;
    }

    const validation = validateSignupRequestInput({
      username,
      year,
      password,
      signupYears,
      signupYearsText,
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
      notify("인증코드를 전송했습니다. MM DM을 확인하세요.");
      setStep("verify");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode() {
    if (pending) {
      return;
    }

    const validation = validateSignupVerifyInput({
      username,
      code,
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
          servicePolicyId: policies.service.id,
          privacyPolicyId: policies.privacy.id,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        applyErrorAction(getSignupVerifyErrorAction(data.error, data.message));
        return;
      }

      setFieldErrors({});
      setFormError(null);
      notify("회원가입이 완료되었습니다.");
      router.replace("/notifications");
    } finally {
      setPending(false);
    }
  }

  function resetToRequestStep() {
    setStep("request");
    setFormError(null);
  }

  return {
    step,
    username,
    year,
    password,
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
    setCode,
    setPolicyChecked,
    clearFieldError,
    requestCode,
    verifyCode,
    resetToRequestStep,
  };
}
