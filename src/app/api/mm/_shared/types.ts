import { getRequestLogContext } from "@/lib/activity-logs";

export type MmRouteContext = ReturnType<typeof getRequestLogContext>;

export type MemberAuthAction = "request-code" | "verify-code" | "reset-password";

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
  servicePolicyId?: string;
  privacyPolicyId?: string;
};

export type ResetPasswordBody = {
  username?: string;
};

