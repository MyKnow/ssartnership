import { getServerActionLogContext } from "@/lib/activity-logs";
import type { AuditPrincipal, AtomicAuditContext } from "./audit-rpc-context";

export {
  buildAtomicAuditRpcContext,
  type AuditActorType,
  type AuditPrincipal,
  type AuditRequestContext,
  type AtomicAuditContext,
} from "./audit-rpc-context";

export async function createServerActionAuditContext(
  principal: AuditPrincipal,
  fallbackPath: string,
): Promise<AtomicAuditContext> {
  const context = await getServerActionLogContext(fallbackPath);
  return {
    principal,
    request: {
      requestId: context.requestId ?? crypto.randomUUID(),
      path: context.path ?? null,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
    },
  };
}
