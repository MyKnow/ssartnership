"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import PolicyAgreementField from "@/components/auth/PolicyAgreementField";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import Input from "@/components/ui/Input";
import PasswordInput from "@/components/ui/PasswordInput";
import { focusField, getFieldErrorClass } from "@/components/ui/form-field-state";
import { useToast } from "@/components/ui/Toast";
import {
  getMemberSignupActionState,
  getMemberSignupConfirmPasswordError,
  getMemberSignupPasswordError,
  getMemberSignupPasswordFieldErrors,
  parseMemberSignupCompleteInput,
  type MemberSignupCompleteFieldErrors,
} from "@/lib/member-signup";
import { formatSsafyYearLabel } from "@/lib/ssafy-year";
import type { MattermostSignupMode } from "@/lib/mm-signup-approval";
import type { PolicyDocument, RequiredPolicyMap } from "@/lib/policy-documents";
import { sanitizeReturnTo } from "@/lib/return-to";
import { uploadImagesToStaging } from "@/lib/image-upload/client";
import { isUuid } from "@/lib/uuid";
import { MEMBER_SIGNUP_PROFILE_PURPOSE } from "@/lib/image-upload/signup";

type Props = {
  session: {
    mmUserId: string;
    mmUsername: string;
    displayName: string;
    subjectGeneration: number;
    senderGeneration: number;
    signupMode?: MattermostSignupMode;
  };
  requiredPolicies: RequiredPolicyMap;
  marketingPolicy: PolicyDocument | null;
  returnTo?: string;
};

export default function MattermostSignupCompleteForm({
  session,
  requiredPolicies,
  marketingPolicy,
  returnTo,
}: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const signupMode = session.signupMode ?? "direct";
  const isApprovalMode = signupMode === "approval";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checked, setChecked] = useState({
    service: false,
    privacy: false,
    marketing: false,
  });
  const [fieldErrors, setFieldErrors] = useState<MemberSignupCompleteFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [profileImage, setProfileImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [profileImageStatus, setProfileImageStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const profileImageUploadIdRef = useRef<string | null>(null);
  const profileImageKey = `signup:profile-image-upload:${session.mmUserId}`;
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);
  const serviceRef = useRef<HTMLInputElement>(null);
  const privacyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUploadId = sessionStorage.getItem(profileImageKey);
    if (storedUploadId && isUuid(storedUploadId)) {
      profileImageUploadIdRef.current = storedUploadId;
    }

    let previewUrl: string | null = null;
    const controller = new AbortController();
    async function loadMattermostProfileImage() {
      try {
        const response = await fetch("/api/mm/signup/profile-image", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (response.status === 404) {
          setProfileImageStatus("unavailable");
          return;
        }
        if (!response.ok) {
          throw new Error("profile_image_unavailable");
        }
        const blob = await response.blob();
        if (!blob.size) throw new Error("profile_image_empty");
        const file = new File([blob], "mattermost-profile.webp", { type: "image/webp" });
        previewUrl = URL.createObjectURL(blob);
        setProfileImage({ file, previewUrl });
        setProfileImageStatus("ready");
      } catch {
        if (!controller.signal.aborted) setProfileImageStatus("error");
      }
    }
    void loadMattermostProfileImage();
    return () => {
      controller.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [profileImageKey]);
  const actionState = getMemberSignupActionState({
    password,
    confirmPassword,
    serviceChecked: checked.service,
    privacyChecked: checked.privacy,
    marketingChecked: checked.marketing,
    hasMarketingPolicy: Boolean(marketingPolicy),
  });

  function clearError(field?: keyof MemberSignupCompleteFieldErrors) {
    if (field) {
      setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    } else {
      setFieldErrors({});
    }
    setFormError(null);
  }

  function clearProfileImageUploadDraft() {
    profileImageUploadIdRef.current = null;
    sessionStorage.removeItem(profileImageKey);
  }

  function setPasswordFieldErrors(nextErrors: Pick<MemberSignupCompleteFieldErrors, "password" | "confirmPassword">) {
    setFieldErrors((previous) => ({
      ...previous,
      ...(Object.hasOwn(nextErrors, "password") ? { password: nextErrors.password } : {}),
      ...(Object.hasOwn(nextErrors, "confirmPassword")
        ? { confirmPassword: nextErrors.confirmPassword }
        : {}),
    }));
    setFormError(null);
  }

  function handlePasswordChange(nextPassword: string) {
    setPassword(nextPassword);
    setPasswordFieldErrors({
      password: undefined,
      confirmPassword: getMemberSignupConfirmPasswordError(
        nextPassword,
        confirmPassword,
        false,
      ),
    });
  }

  function handlePasswordBlur() {
    setPasswordFieldErrors(
      getMemberSignupPasswordFieldErrors(
        { password, confirmPassword },
        { requireConfirmPassword: false },
      ),
    );
  }

  function handleConfirmPasswordChange(nextConfirmPassword: string) {
    setConfirmPassword(nextConfirmPassword);
    setPasswordFieldErrors({
      confirmPassword: getMemberSignupConfirmPasswordError(
        password,
        nextConfirmPassword,
        false,
      ),
    });
  }

  function handleConfirmPasswordBlur() {
    setPasswordFieldErrors({
      password: getMemberSignupPasswordError(password, false),
      confirmPassword: getMemberSignupConfirmPasswordError(password, confirmPassword),
    });
  }

  function focusFirstError(errors: MemberSignupCompleteFieldErrors) {
    if (errors.password) {
      focusField(passwordRef);
      return;
    }
    if (errors.confirmPassword) {
      focusField(confirmPasswordRef);
      return;
    }
    if (errors.servicePolicyId) {
      focusField(serviceRef);
      return;
    }
    if (errors.privacyPolicyId) {
      focusField(privacyRef);
    }
  }

  async function handleSubmit() {
    if (pending || actionState.disabled || profileImageStatus === "loading") return;

    if (
      actionState.submissionChecked.service !== checked.service
      || actionState.submissionChecked.privacy !== checked.privacy
      || actionState.submissionChecked.marketing !== checked.marketing
    ) {
      setChecked(actionState.submissionChecked);
    }

    let profileImageUploadId = profileImageUploadIdRef.current;
    const payload = {
      password,
      confirmPassword,
      servicePolicyId: actionState.submissionChecked.service ? requiredPolicies.service.id : "",
      privacyPolicyId: actionState.submissionChecked.privacy ? requiredPolicies.privacy.id : "",
      marketingPolicyId: marketingPolicy?.id ?? null,
      marketingPolicyChecked: Boolean(marketingPolicy && actionState.submissionChecked.marketing),
      profileImageUploadId,
      returnTo: sanitizeReturnTo(returnTo, "/"),
    };
    const parsed = parseMemberSignupCompleteInput(payload);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setFormError(null);
      focusFirstError(parsed.fieldErrors);
      return;
    }

    setPending(true);
    setFieldErrors({});
    setFormError(null);
    try {
      if (!profileImageUploadId && profileImage?.file) {
        const [uploaded] = await uploadImagesToStaging({
          purpose: MEMBER_SIGNUP_PROFILE_PURPOSE,
          actorMode: "signup",
          uploads: [{
            clientId: "mattermost-profile",
            role: "profile",
            file: profileImage.file,
          }],
        });
        profileImageUploadId = uploaded?.uploadId ?? null;
        if (!profileImageUploadId) throw new Error("프로필 사진 업로드 결과를 확인해 주세요.");
        profileImageUploadIdRef.current = profileImageUploadId;
        sessionStorage.setItem(profileImageKey, profileImageUploadId);
      }
      const requestPayload = { ...payload, profileImageUploadId };
      const response = await fetch("/api/mm/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.error === "invalid_request") {
          const nextFieldErrors = data.fieldErrors ?? {};
          setFieldErrors(nextFieldErrors);
          focusFirstError(nextFieldErrors);
          return;
        }
        if (data.error === "policy_outdated") {
          setFormError(data.message ?? "약관 버전이 변경되었습니다. 다시 확인해 주세요.");
          router.refresh();
          return;
        }
        if (data.error === "already_registered") {
          clearProfileImageUploadDraft();
          sessionStorage.setItem("signup:alreadyRegistered", "1");
          router.replace(data.redirectTo ?? "/auth/login");
          return;
        }
        if (data.error === "verification_expired") {
          clearProfileImageUploadDraft();
          setFormError("Mattermost 인증 상태가 만료되었습니다. 인증 코드를 다시 요청해 주세요.");
          return;
        }
        if (data.error === "generation_completed") {
          clearProfileImageUploadDraft();
          setFormError("선택한 기수는 회원가입을 진행할 수 없습니다.");
          return;
        }
        if (data.error === "approval_pending") {
          notify("승인 요청이 접수되었습니다.");
          router.replace(data.redirectTo ?? "/auth/signup/pending");
          return;
        }
        if (data.error === "signup_failed" || response.status === 503) {
          clearProfileImageUploadDraft();
        }
        setFormError("회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      if (isApprovalMode) {
        sessionStorage.removeItem(profileImageKey);
        notify("승인 요청이 접수되었습니다.");
        router.replace(data.redirectTo ?? "/auth/signup/pending");
        return;
      }
      sessionStorage.setItem("signup:success", "1");
      sessionStorage.removeItem(profileImageKey);
      notify("회원가입이 완료되었습니다.");
      router.replace(data.redirectTo ?? "/");
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : "프로필 사진을 포함한 회원가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-5">
      <div className={isApprovalMode ? "grid gap-4" : "grid gap-4 sm:grid-cols-3"}>
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          MM 아이디
          <Input value={session.mmUsername} disabled aria-label="MM 아이디" />
        </label>
        {!isApprovalMode ? (
          <>
            <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
              이름
              <Input value={session.displayName} disabled aria-label="이름" />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
              기수
              <Input
                value={formatSsafyYearLabel(session.subjectGeneration)}
                disabled
                aria-label="기수"
              />
            </label>
          </>
        ) : null}
      </div>

      <section className="grid gap-3 rounded-card border border-border bg-surface-inset p-4" aria-label="Mattermost 프로필 사진">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Mattermost 프로필 사진</h2>
          {profileImageStatus === "loading" ? <span className="text-xs text-muted-foreground">불러오는 중</span> : null}
        </div>
        {profileImage ? (
          <div className="flex items-center gap-4">
            <Image
              src={profileImage.previewUrl}
              alt="Mattermost 프로필 사진"
              width={96}
              height={96}
              unoptimized
              className="h-24 w-24 rounded-full object-cover ring-1 ring-border"
            />
            <p className="text-sm leading-6 text-muted-foreground">
              현재 Mattermost 프로필 사진을 사용합니다. 본인 사진이 아니라면 가입 후 본인 사진으로 변경해야 할 수 있습니다.
            </p>
          </div>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Mattermost 프로필 사진이 없어 가입 후 본인 사진을 별도로 등록해야 합니다.
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          사이트 비밀번호
          <PasswordInput
            ref={passwordRef}
            value={password}
            onChange={(event) => handlePasswordChange(event.target.value)}
            onBlur={handlePasswordBlur}
            placeholder="비밀번호"
            aria-label="사이트 비밀번호"
            required
            aria-invalid={Boolean(fieldErrors.password) || undefined}
            className={getFieldErrorClass(Boolean(fieldErrors.password))}
          />
          {fieldErrors.password ? <FormMessage variant="error">{fieldErrors.password}</FormMessage> : null}
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          비밀번호 확인
          <PasswordInput
            ref={confirmPasswordRef}
            value={confirmPassword}
            onChange={(event) => handleConfirmPasswordChange(event.target.value)}
            onBlur={handleConfirmPasswordBlur}
            placeholder="비밀번호 확인"
            aria-label="비밀번호 확인"
            required
            aria-invalid={Boolean(fieldErrors.confirmPassword) || undefined}
            className={getFieldErrorClass(Boolean(fieldErrors.confirmPassword))}
          />
          {fieldErrors.confirmPassword ? <FormMessage variant="error">{fieldErrors.confirmPassword}</FormMessage> : null}
        </label>
      </div>

      <div className="flex flex-col gap-4">
        <PolicyAgreementField
          policy={requiredPolicies.service}
          checked={checked.service}
          onChange={(next) => {
            setChecked((previous) => ({ ...previous, service: next }));
            clearError("servicePolicyId");
          }}
          disabled={pending}
          invalid={Boolean(fieldErrors.servicePolicyId)}
          inputRef={serviceRef}
          required
        />
        <PolicyAgreementField
          policy={requiredPolicies.privacy}
          checked={checked.privacy}
          onChange={(next) => {
            setChecked((previous) => ({ ...previous, privacy: next }));
            clearError("privacyPolicyId");
          }}
          disabled={pending}
          invalid={Boolean(fieldErrors.privacyPolicyId)}
          inputRef={privacyRef}
          required
        />
        {marketingPolicy ? (
          <PolicyAgreementField
            policy={marketingPolicy}
            checked={checked.marketing}
            onChange={(next) => {
              setChecked((previous) => ({ ...previous, marketing: next }));
              clearError();
            }}
            disabled={pending}
            required={false}
          />
        ) : null}
      </div>

      {fieldErrors.servicePolicyId || fieldErrors.privacyPolicyId ? (
        <FormMessage variant="error">필수 약관에 모두 동의해 주세요.</FormMessage>
      ) : null}
      {formError ? <FormMessage variant="error">{formError}</FormMessage> : null}

      <Button
        onClick={handleSubmit}
        loading={pending}
        loadingText={isApprovalMode ? "신청 처리 중" : "가입 처리 중"}
        disabled={actionState.disabled || profileImageStatus === "loading"}
        className="w-full"
      >
        {isApprovalMode
          ? actionState.label === "회원가입하기"
            ? "회원가입 신청"
            : "모두 동의하고 신청하기"
          : actionState.label}
      </Button>
    </div>
  );
}
