import {
  canAdmin,
  type AdminPermissionMatrix,
  type AdminPermissionTemplateKey,
} from '@/lib/admin-permissions';
import type { AdminLogsAccessCapabilities, LogGroup } from '@/lib/log-insights';

type AdminLogPolicyInput = {
  permissionId?: AdminPermissionTemplateKey | null;
  permissions?: AdminPermissionMatrix | null;
};

const NO_LOG_ACCESS: AdminLogsAccessCapabilities = {
  readGroups: [],
  exportGroups: [],
  includePii: false,
};

const LOG_ACCESS_BY_TEMPLATE: Partial<
  Record<AdminPermissionTemplateKey, AdminLogsAccessCapabilities>
> = {
  super_admin: {
    readGroups: ['product', 'audit', 'security'],
    exportGroups: ['product', 'audit', 'security'],
    includePii: true,
  },
  operations_manager: {
    readGroups: ['product', 'audit', 'security'],
    exportGroups: ['product', 'audit', 'security'],
    includePii: true,
  },
  content_manager: {
    readGroups: ['product', 'audit'],
    exportGroups: [],
    includePii: false,
  },
  support: {
    readGroups: ['audit', 'security'],
    exportGroups: [],
    includePii: false,
  },
  readonly: {
    readGroups: ['product', 'audit'],
    exportGroups: [],
    includePii: false,
  },
};

function copyPolicy(policy: AdminLogsAccessCapabilities): AdminLogsAccessCapabilities {
  return {
    readGroups: [...policy.readGroups],
    exportGroups: [...policy.exportGroups],
    includePii: policy.includePii,
  };
}

export function getAdminLogAccessPolicy(
  input: AdminLogPolicyInput,
): AdminLogsAccessCapabilities {
  if (!input.permissionId || !canAdmin(input.permissions, 'logs', 'read')) {
    return copyPolicy(NO_LOG_ACCESS);
  }

  const policy = LOG_ACCESS_BY_TEMPLATE[input.permissionId];
  return policy ? copyPolicy(policy) : copyPolicy(NO_LOG_ACCESS);
}

export function selectAllowedLogGroups(
  requestedGroups: LogGroup[],
  allowedGroups: LogGroup[],
) {
  const allowed = new Set<LogGroup>(allowedGroups);
  return Array.from(new Set(requestedGroups)).filter((group) => allowed.has(group));
}

export function isAllowedLogGroup(
  group: string | null | undefined,
  allowedGroups: LogGroup[],
) {
  if (group === 'partner') {
    return allowedGroups.length > 0;
  }
  return group === 'product' || group === 'audit' || group === 'security'
    ? allowedGroups.includes(group)
    : group === null || group === undefined || group === '' || group === 'all';
}
