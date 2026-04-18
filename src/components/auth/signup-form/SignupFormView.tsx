"use client";

import FormMessage from "@/components/ui/FormMessage";
import SignupActions from "@/components/auth/signup-form/SignupActions";
import SignupGuideCard from "@/components/auth/signup-form/SignupGuideCard";
import SignupIdentityFields from "@/components/auth/signup-form/SignupIdentityFields";
import SignupPoliciesSection from "@/components/auth/signup-form/SignupPoliciesSection";
import SignupVerificationField from "@/components/auth/signup-form/SignupVerificationField";
import type { SignupFormProps } from "@/components/auth/signup-form/types";
import { useSignupFormController } from "@/components/auth/signup-form/useSignupFormController";

export default function SignupFormView(props: SignupFormProps) {
  const signup = useSignupFormController(props);

  return (
    <div className="mt-6 flex flex-col gap-4">
      <SignupIdentityFields
        username={signup.username}
        year={signup.year}
        password={signup.password}
        step={signup.step}
        signupYears={signup.signupYears}
        usernameError={signup.fieldErrors.username}
        yearError={signup.fieldErrors.year}
        passwordError={signup.fieldErrors.password}
        usernameRef={signup.refs.usernameRef}
        yearGroupRef={signup.refs.yearGroupRef}
        passwordRef={signup.refs.passwordRef}
        onUsernameChange={(value) => {
          signup.setUsername(value);
          signup.clearFieldError("username");
        }}
        onYearChange={(value) => {
          signup.setYear(value);
          signup.clearFieldError("year");
        }}
        onPasswordChange={(value) => {
          signup.setPassword(value);
          signup.clearFieldError("password");
        }}
      />

      <SignupGuideCard items={signup.guideItems} />

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

      {signup.step === "verify" ? (
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

      {signup.formError ? <FormMessage variant="error">{signup.formError}</FormMessage> : null}

      <SignupActions
        step={signup.step}
        pending={signup.pending}
        onRequestCode={signup.requestCode}
        onVerifyCode={signup.verifyCode}
        onResetToRequest={signup.resetToRequestStep}
      />
    </div>
  );
}
