import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import {
  type AdminAuditAction,
  type AuthSecurityEventName,
  type AuthSecurityStatus,
  type EventActorType,
  type ProductEventName,
} from '@/lib/event-catalog';
import { normalizeProductEventLocation } from '@/lib/product-event-path';
import { redactAuthSecurityExceptionProperties } from '@/lib/auth-security-log-sanitize';
import { sanitizeLogProperties, type LogJsonValue } from '@/lib/log-sanitization';
import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { getSignedUserSession } from '@/lib/user-auth';
import { getPartnerSession } from '@/lib/partner-session';
import { sanitizeProductEventTargetId } from '@/lib/activity-log-targets';
import { getClientIp } from '@/lib/client-ip';
import type { AuditActorType } from '@/lib/audit-rpc-context';

type BaseLogContext = {
  path?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  host?: string | null;
  requestId?: string | null;
};

type ProductLogInput = BaseLogContext & {
  eventName: ProductEventName;
  eventId?: string | null;
  schemaVersion?: number | null;
  occurredAt?: string | null;
  actorType: EventActorType;
  actorId?: string | null;
  sessionId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  properties?: Record<string, unknown> | null;
};

type AdminAuditInput = BaseLogContext & {
  action: AdminAuditAction;
  actorType?: AuditActorType;
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

function getPathFromValue(value: string | null) {
  return normalizeProductEventLocation(value);
}

function sanitizeProperties(
  properties?: Record<string, unknown> | null,
): Record<string, LogJsonValue> {
  return sanitizeLogProperties(properties);
}

function sanitizeAuthSecurityProperties(
  properties?: Record<string, unknown> | null,
) {
  const sanitized = sanitizeProperties(properties);
  return redactAuthSecurityExceptionProperties(sanitized);
}

async function insertLog(table: string, payload: Record<string, unknown>) {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from(table).insert(payload);
    if (error) {
      console.error('[activity-log] log_insert_failed', {
        table,
        requestId: payload.request_id ?? null,
        reasonCode: 'insert_failed',
      });
      return false;
    }
    return true;
  } catch {
    console.error('[activity-log] log_insert_failed', {
      table,
      requestId: payload.request_id ?? null,
      reasonCode: 'insert_exception',
    });
    return false;
  }
}

function getOccurredAt(value?: string | null) {
  if (!value) {
    return new Date().toISOString();
  }
  const occurredAt = new Date(value);
  return Number.isNaN(occurredAt.getTime())
    ? new Date().toISOString()
    : occurredAt.toISOString();
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
    requestId: randomUUID(),
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
    requestId: randomUUID(),
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

  const adminSession = await getAdminSession();
  if (adminSession) {
    return {
      actorType: 'admin',
      actorId: adminSession.adminId,
    };
  }

  const partnerSession = await getPartnerSession().catch(() => null);
  if (partnerSession?.accountId) {
    return {
      actorType: 'partner',
      actorId: partnerSession.accountId,
    };
  }

  return {
    actorType: 'guest',
    actorId: null,
  };
}

export async function logProductEvent(input: ProductLogInput) {
  const targetId = sanitizeProductEventTargetId(input.targetType, input.targetId);
  const eventId = input.eventId ?? randomUUID();

  try {
    const { data, error } = await getSupabaseAdminClient().rpc('ingest_product_event', {
      input_event_id: eventId,
      input_schema_version: input.schemaVersion ?? 1,
      input_occurred_at: getOccurredAt(input.occurredAt),
      input_request_id: input.requestId ?? null,
      input_session_id: input.sessionId ?? null,
      input_actor_type: input.actorType,
      input_actor_id: input.actorId ?? null,
      input_event_name: input.eventName,
      input_path: normalizeProductEventLocation(input.path ?? null),
      input_referrer: normalizeProductEventLocation(input.referrer ?? null),
      input_target_type: input.targetType ?? null,
      input_target_id: targetId,
      input_properties: sanitizeProperties(input.properties),
      input_user_agent: input.userAgent ?? null,
      input_ip_address: input.ipAddress ?? null,
    });

    if (error) {
      console.error('[activity-log] product_event_ingest_failed', {
        eventId,
        requestId: input.requestId ?? null,
        reasonCode: 'ingest_failed',
      });
      return false;
    }

    return data === true;
  } catch {
    console.error('[activity-log] product_event_ingest_failed', {
      eventId,
      requestId: input.requestId ?? null,
      reasonCode: 'ingest_exception',
    });
    return false;
  }
}

export function scheduleProductEventLog(input: ProductLogInput) {
  after(async () => {
    await logProductEvent(input);
  });
}

export async function logAdminAudit(input: AdminAuditInput) {
  const adminSession = await getAdminSession();
  const actorId = input.actorId ?? adminSession?.adminId ?? 'system';
  return insertLog('admin_audit_logs', {
    actor_type: input.actorType ?? (actorId === 'system' ? 'system' : 'admin'),
    actor_id: actorId,
    action: input.action,
    path: normalizeProductEventLocation(input.path ?? null),
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    properties: sanitizeProperties(input.properties),
    user_agent: input.userAgent ?? null,
    ip_address: input.ipAddress ?? null,
    request_id: input.requestId ?? null,
  });
}

export async function logAuthSecurity(input: AuthSecurityInput) {
  await insertLog('auth_security_logs', {
    event_name: input.eventName,
    status: input.status,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    identifier: input.identifier ?? null,
    path: normalizeProductEventLocation(input.path ?? null),
    properties: sanitizeAuthSecurityProperties(input.properties),
    user_agent: input.userAgent ?? null,
    ip_address: input.ipAddress ?? null,
    request_id: input.requestId ?? null,
  });
}
