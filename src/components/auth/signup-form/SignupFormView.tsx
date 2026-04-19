"use client";

import FormMessage from "@/components/ui/FormMessage";
import SignupActions from "@/components/auth/signup-form/SignupActions";
import SignupIdentityFields from "@/components/auth/signup-form/SignupIdentityFields";
import SignupPoliciesSection from "@/components/auth/signup-form/SignupPoliciesSection";
import SignupPasswordFields from "@/components/auth/signup-form/SignupPasswordFields";
import SignupVerificationField from "@/components/auth/signup-form/SignupVerificationField";
import type { SignupFormProps } from "@/components/auth/signup-form/types";
import { useSignupFormController } from "@/components/auth/signup-form/useSignupFormController";

export default function SignupFormView(props: SignupFormProps) {
  const signup = useSignupFormController(props);
  const hasRequiredPolicies = signup.policyChecked.service && signup.policyChecked.privacy;
  const requestCodeLabel = hasRequiredPolicies
    ? "인증번호 요청"
    : "약관 동의 후 인증번호 요청";
  const handleRequestCode = () => {
    if (hasRequiredPolicies) {
      signup.requestCode();
      return;
    }

    signup.setPolicyChecked({
      service: true,
      privacy: true,
      marketing: Boolean(props.marketingPolicy),
    });
    signup.requestCode({
      service: true,
      privacy: true,
      marketing: Boolean(props.marketingPolicy),
    });
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      {signup.step === "auth" ? (
        <>
          <SignupIdentityFields
            username={signup.username}
            year={signup.year}
            locked={signup.codeRequested || signup.pending}
            signupYears={signup.signupYears}
            usernameError={signup.fieldErrors.username}
            yearError={signup.fieldErrors.year}
            usernameRef={signup.refs.usernameRef}
            yearGroupRef={signup.refs.yearGroupRef}
            onUsernameChange={(value) => {
              signup.setUsername(value);
              signup.clearFieldError("username");
            }}
            onYearChange={(value) => {
              signup.setYear(value);
              signup.clearFieldError("year");
            }}
          />

          <SignupPoliciesSection
            policies={props.policies}
            marketingPolicy={props.marketingPolicy}
            policyChecked={signup.policyChecked}
            pending={signup.pending}
            error={signup.fieldErrors.policies}
            servicePolicyRef={signup.refs.servicePolicyRef}
            onPolicyChange={(key, checked) => {
              signup.setPolicyChecked((prev) => ({ ...prev, [key]: checked }));
              signup.clearFieldError("policies");
            }}
          />

          {signup.codeRequested ? (
            <SignupVerificationField
              code={signup.code}
              error={signup.fieldErrors.code}
              codeRef={signup.refs.codeRef}
              onCodeChange={(value) => {
                signup.setCode(value);
                signup.clearFieldError("code");
              }}
            />
          ) : null}
        </>
      ) : (
        <SignupPasswordFields
          password={signup.password}
          passwordConfirm={signup.passwordConfirm}
          passwordError={signup.fieldErrors.password}
          passwordConfirmError={signup.fieldErrors.passwordConfirm}
          passwordRef={signup.refs.passwordRef}
          passwordConfirmRef={signup.refs.passwordConfirmRef}
          pending={signup.pending}
          onPasswordChange={(value) => {
            signup.setPassword(value);
            signup.clearFieldError("password");
          }}
          onPasswordConfirmChange={(value) => {
            signup.setPasswordConfirm(value);
            signup.clearFieldError("passwordConfirm");
          }}
          onGeneratePassword={signup.generatePassword}
        />
      )}

      {signup.formError ? <FormMessage variant="error">{signup.formError}</FormMessage> : null}

      <SignupActions
        step={signup.step}
        codeRequested={signup.codeRequested}
        requestCodeLabel={requestCodeLabel}
        pending={signup.pending}
        onRequestCode={handleRequestCode}
        onNext={signup.moveToSignupStep}
        onSubmitSignup={signup.verifyCode}
        onResetToRequest={signup.resetToRequestStep}
        onResetToAuth={signup.resetToAuthStep}
      />
    </div>
  );
}
