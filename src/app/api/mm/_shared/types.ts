import { getRequestLogContext } from "@/lib/activity-logs";

export type MmRouteContext = ReturnType<typeof getRequestLogContext>;

export type MemberAuthAction =
  | "request-code"
  | "verify-code"
  | "reset-password"
  | "request-reset-code"
  | "verify-reset-code";

export type MemberAuthThrottleContext = {
  ipAddress: string | null;
  accountIdentifier: string | null;
};

export type RequestCodeBody = {
  username?: string;
  year?: string | number;
};

export type VerifyCodeBody = {
  username?: string;
  code?: string;
  password?: string;
  autoLogin?: boolean;
  servicePolicyId?: string;
  privacyPolicyId?: string;
  marketingPolicyId?: string | null;
  marketingPolicyChecked?: boolean;
};

export type ResetPasswordBody = {
  username?: string;
};

export type ResetPasswordVerifyBody = {
  username?: string;
  code?: string;
};

export type ResetPasswordCompleteBody = {
  token?: string;
  nextPassword?: string;
  nextPasswordConfirm?: string;
};
