import { getRequestLogContext } from "@/lib/activity-logs";

export type MmRouteContext = ReturnType<typeof getRequestLogContext>;

export type MemberAuthAction =
  | "reset-password"
  | "request-reset-code"
  | "verify-reset-code";

export type MemberAuthThrottleContext = {
  ipAddress: string | null;
  accountIdentifier: string | null;
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
