import type { RefObject } from "react";
import type { RequiredPolicyMap } from "@/lib/policy-documents";

export type SignupStep = "request" | "verify";
export type SignupField = "username" | "year" | "password" | "code" | "policies";

export type SignupPolicyState = {
  service: boolean;
  privacy: boolean;
};

export type SignupGuideItem = {
  label: string;
  description: string;
};

export type SignupFormProps = {
  policies: RequiredPolicyMap;
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
  password: string;
  signupYears: number[];
  signupYearsText: string;
  policyChecked: SignupPolicyState;
};

export type SignupVerifyValidationInput = {
  username: string;
  code: string;
  policyChecked: SignupPolicyState;
};

export type SignupFieldRefs = {
  usernameRef: RefObject<HTMLInputElement | null>;
  yearGroupRef: RefObject<HTMLDivElement | null>;
  passwordRef: RefObject<HTMLInputElement | null>;
  codeRef: RefObject<HTMLInputElement | null>;
  servicePolicyRef: RefObject<HTMLInputElement | null>;
};
