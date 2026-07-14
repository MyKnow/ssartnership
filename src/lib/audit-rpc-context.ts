import { sanitizeLogProperties, type LogJsonValue } from "./log-sanitization.ts";
import { normalizeProductEventLocation } from "./product-event-path.ts";

export const AUDIT_ACTOR_TYPES = [
  "admin",
  "partner",
  "member",
  "system",
] as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export type AuditPrincipal = {
  actorType: AuditActorType;
  actorId: string | null;
};

export type AuditRequestContext = {
  requestId: string;
  path: string | null;
  userAgent: string | null;
  ipAddress: string | null;
};

export type AtomicAuditContext = {
  principal: AuditPrincipal;
  request: AuditRequestContext;
};

export function buildAtomicAuditRpcContext(
  context: AtomicAuditContext,
  properties: Record<string, unknown>,
): {
  p_actor_type: AuditActorType;
  p_actor_id: string | null;
  p_request_id: string;
  p_path: string | null;
  p_user_agent: string | null;
  p_ip_address: string | null;
  p_properties: Record<string, LogJsonValue>;
} {
  return {
    p_actor_type: context.principal.actorType,
    p_actor_id: context.principal.actorId,
    p_request_id: context.request.requestId,
    p_path: normalizeProductEventLocation(context.request.path),
    p_user_agent: context.request.userAgent,
    p_ip_address: context.request.ipAddress,
    p_properties: sanitizeLogProperties(properties),
  };
}
