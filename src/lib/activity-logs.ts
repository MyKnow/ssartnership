import { headers } from 'next/headers';
import { isAdminSession } from '@/lib/auth';
import {
  type AdminAuditAction,
  type AuthSecurityEventName,
  type AuthSecurityStatus,
  type EventActorType,
  type ProductEventName,
} from '@/lib/event-catalog';
import { SITE_URL } from '@/lib/site';
import { normalizeProductEventLocation } from '@/lib/product-event-path';
import {
  type PartnerMetricEventName,
  reconcilePartnerMetricRollupsFromEventLogs,
  upsertPartnerMetricRollupsFromEventInput,
} from '@/lib/partner-metric-rollups';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { getSignedUserSession } from '@/lib/user-auth';

type HeaderSource = {
  get(name: string): string | null;
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

type BaseLogContext = {
  path?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  host?: string | null;
};

type ProductLogInput = BaseLogContext & {
  eventName: ProductEventName;
  actorType: EventActorType;
  actorId?: string | null;
  sessionId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  properties?: Record<string, unknown> | null;
};

type AdminAuditInput = BaseLogContext & {
  action: AdminAuditAction;
  actorId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  properties?: Record<string, unknown> | null;
};

type AuthSecurityInput = BaseLogContext & {
  eventName: AuthSecurityEventName;
  status: AuthSecurityStatus;
  actorType: EventActorType;
  actorId?: string | null;
  identifier?: string | null;
  properties?: Record<string, unknown> | null;
};

function getClientIp(headerStore: HeaderSource) {
  const forwarded = headerStore.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null;
  }
  return headerStore.get('x-real-ip');
}

function getPathFromValue(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const base = new URL(SITE_URL);
    const parsed = new URL(value, base);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return value;
  }
}

function sanitizeJsonValue(value: unknown): JsonValue | undefined {
  if (value === null) {
    return null;
  }
  if (value === undefined) {
    return undefined;
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeJsonValue(item))
      .filter((item): item is JsonValue => item !== undefined);
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => [key, sanitizeJsonValue(entryValue)] as const)
      .filter(([, entryValue]) => entryValue !== undefined);
    return Object.fromEntries(entries) as { [key: string]: JsonValue };
  }
  return String(value);
}

function sanitizeProperties(
  properties?: Record<string, unknown> | null,
): Record<string, JsonValue> {
  const sanitized = sanitizeJsonValue(properties ?? {}) ?? {};
  return sanitized && !Array.isArray(sanitized) && typeof sanitized === 'object'
    ? sanitized
    : {};
}

async function insertLog(table: string, payload: Record<string, unknown>) {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from(table).insert(payload);
    if (error) {
      console.error(`[activity-log] ${table} insert failed`, error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[activity-log] ${table} insert failed`, error);
    return false;
  }
}

export async function getServerActionLogContext(
  fallbackPath?: string,
): Promise<BaseLogContext> {
  const headerStore = await headers();
  const referrer = headerStore.get('referer');
  const referrerPath = getPathFromValue(referrer);

  return {
    path: referrerPath ?? fallbackPath ?? null,
    referrer,
    userAgent: headerStore.get('user-agent'),
    ipAddress: getClientIp(headerStore),
    host: headerStore.get('host'),
  };
}

export function getRequestLogContext(request: Request): BaseLogContext {
  const referrer = request.headers.get('referer');
  return {
    path: getPathFromValue(request.url),
    referrer,
    userAgent: request.headers.get('user-agent'),
    ipAddress: getClientIp(request.headers),
    host: request.headers.get('host'),
  };
}

export async function resolveCurrentActor(): Promise<{
  actorType: EventActorType;
  actorId: string | null;
}> {
  const memberSession = await getSignedUserSession();
  if (memberSession?.userId) {
    return {
      actorType: 'member',
      actorId: memberSession.userId,
    };
  }

  if (await isAdminSession()) {
    return {
      actorType: 'admin',
      actorId: process.env.ADMIN_ID ?? 'admin',
    };
  }

  return {
    actorType: 'guest',
    actorId: null,
  };
}

export async function logProductEvent(input: ProductLogInput) {
  const inserted = await insertLog('event_logs', {
    session_id: input.sessionId ?? null,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    event_name: input.eventName,
    path: normalizeProductEventLocation(input.path ?? null),
    referrer: normalizeProductEventLocation(input.referrer ?? null),
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    properties: sanitizeProperties(input.properties),
    user_agent: input.userAgent ?? null,
    ip_address: input.ipAddress ?? null,
  });

  if (!inserted) {
    if (input.targetType === "partner" && input.targetId) {
      try {
        await upsertPartnerMetricRollupsFromEventInput({
          partnerId: input.targetId,
          eventName: input.eventName as PartnerMetricEventName,
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          sessionId: input.sessionId ?? null,
        });
      } catch (error) {
        console.error("[activity-log] partner metric fallback upsert failed", error);
      }
    }
    return;
  }

  if (input.targetType === "partner" && input.targetId) {
    try {
      await reconcilePartnerMetricRollupsFromEventLogs(input.targetId);
    } catch (error) {
      console.error("[activity-log] partner metric reconcile failed", error);
    }
  }
}

export async function logAdminAudit(input: AdminAuditInput) {
  await insertLog('admin_audit_logs', {
    actor_id: input.actorId ?? process.env.ADMIN_ID ?? 'admin',
    action: input.action,
    path: input.path ?? null,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    properties: sanitizeProperties(input.properties),
    user_agent: input.userAgent ?? null,
    ip_address: input.ipAddress ?? null,
  });
}

export async function logAuthSecurity(input: AuthSecurityInput) {
  await insertLog('auth_security_logs', {
    event_name: input.eventName,
    status: input.status,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    identifier: input.identifier ?? null,
    path: input.path ?? null,
    properties: sanitizeProperties(input.properties),
    user_agent: input.userAgent ?? null,
    ip_address: input.ipAddress ?? null,
  });
}
