import { getRequestLogContext } from "@/lib/activity-logs";

export type MmRouteContext = ReturnType<typeof getRequestLogContext>;

export type MemberAuthAction = "reset-password";

export type MemberAuthThrottleContext = {
  ipAddress: string | null;
  accountIdentifier: string | null;
};

export type ResetPasswordCompleteBody = {
  nextPassword?: string;
  nextPasswordConfirm?: string;
};
