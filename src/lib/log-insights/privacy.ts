import type {
  AdminAuditLogRecord,
  AdminLogsPageData,
  AuthSecurityLogRecord,
  ProductLogRecord,
  UnifiedCsvRow,
} from './shared';

export function maskUnifiedCsvRow(
  row: UnifiedCsvRow,
  includePii: boolean,
): UnifiedCsvRow {
  if (includePii) {
    return { ...row };
  }

  return {
    ...row,
    actorName: null,
    actorMmUsername: null,
    actorId: null,
    identifier: null,
    ipAddress: null,
    path: null,
    referrer: null,
    targetId: null,
    properties: null,
  };
}

function maskProductRecord(log: ProductLogRecord): ProductLogRecord {
  return {
    ...log,
    actor_id: null,
    actor_name: null,
    actor_mm_username: null,
    ip_address: null,
    path: null,
    referrer: null,
    target_id: null,
    properties: null,
  };
}

function maskAuditRecord(log: AdminAuditLogRecord): AdminAuditLogRecord {
  return {
    ...log,
    actor_id: null,
    ip_address: null,
    path: null,
    target_id: null,
    properties: null,
  };
}

function maskSecurityRecord(log: AuthSecurityLogRecord): AuthSecurityLogRecord {
  return {
    ...log,
    actor_id: null,
    actor_name: null,
    actor_mm_username: null,
    identifier: null,
    ip_address: null,
    path: null,
    properties: null,
  };
}

export function applyAdminLogsPrivacy(
  data: AdminLogsPageData,
): AdminLogsPageData {
  if (data.access.includePii) {
    return data;
  }

  return {
    ...data,
    summary: {
      ...data.summary,
      topActors: [],
      topIps: [],
      topPaths: [],
    },
    list: {
      ...data.list,
      productLogs: data.list.productLogs.map(maskProductRecord),
      auditLogs: data.list.auditLogs.map(maskAuditRecord),
      securityLogs: data.list.securityLogs.map(maskSecurityRecord),
    },
  };
}
