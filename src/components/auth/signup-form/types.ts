import type { RefObject } from "react";
import type { PolicyDocument, RequiredPolicyMap } from "@/lib/policy-documents";

export type SignupStep = "auth" | "signup";
export type SignupField =
  | "username"
  | "year"
  | "password"
  | "passwordConfirm"
  | "code"
  | "policies";

export type SignupPolicyState = {
  service: boolean;
  privacy: boolean;
  marketing: boolean;
};

export type SignupGuideItem = {
  label: string;
  description: string;
};

export type SignupFormProps = {
  policies: RequiredPolicyMap;
  marketingPolicy?: PolicyDocument | null;
  selectableYears: number[];
  signupYearsText: string;
  defaultYear: number;
};

export type SignupFieldError = Partial<Record<SignupField, string>>;

export type SignupErrorAction =
  | {
      kind: "field";
      field: SignupField;
      message: string;
    }
  | {
      kind: "form";
      message: string;
      nextStep?: SignupStep;
      refresh?: boolean;
    };

export type SignupRequestValidationInput = {
  username: string;
  year: string;
  signupYears: number[];
  signupYearsText: string;
  policyChecked: SignupPolicyState;
};

export type SignupAuthNextValidationInput = {
  code: string;
};

export type SignupVerifyValidationInput = {
  username: string;
  code: string;
  password: string;
  passwordConfirm: string;
  policyChecked: SignupPolicyState;
};

export type SignupFieldRefs = {
  usernameRef: RefObject<HTMLInputElement | null>;
  yearGroupRef: RefObject<HTMLDivElement | null>;
  passwordRef: RefObject<HTMLInputElement | null>;
  passwordConfirmRef: RefObject<HTMLInputElement | null>;
  codeRef: RefObject<HTMLInputElement | null>;
  servicePolicyRef: RefObject<HTMLInputElement | null>;
};
