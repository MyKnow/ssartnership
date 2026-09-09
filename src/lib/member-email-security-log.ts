import { logAuthSecurity } from "@/lib/activity-logs";

type MemberEmailSecurityLogContext = {
  path?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  host?: string | null;
  requestId?: string | null;
};

type MemberEmailSecurityFlow = "verification" | "recovery";
type MemberEmailSecurityStage = "send" | "verify";
type MemberEmailSecurityStatus = "success" | "failure" | "blocked";

type MemberEmailSecurityLogInput = {
  context: MemberEmailSecurityLogContext;
  flow: MemberEmailSecurityFlow;
  stage: MemberEmailSecurityStage;
  status: MemberEmailSecurityStatus;
  actorId: string;
  reason?: string;
};

export function buildMemberEmailSecurityLogInput(
  input: MemberEmailSecurityLogInput,
) {
  const recovery = input.flow === "recovery";
  return {
    ...input.context,
    eventName: recovery
      ? "member_email_recovery"
      : "member_email_verification",
    status: input.status,
    actorType: "member",
    actorId: input.actorId,
    properties: {
      stage: recovery ? `email_${input.stage}` : input.stage,
      ...(input.reason ? { reason: input.reason } : {}),
    },
  } as const;
}

export async function logMemberEmailSecurity(input: MemberEmailSecurityLogInput) {
  return logAuthSecurity(buildMemberEmailSecurityLogInput(input));
}
