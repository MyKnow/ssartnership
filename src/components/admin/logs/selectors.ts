import type { AdminLogsRecordCollections } from "@/lib/log-insights";
import type { GroupFilter, NormalizedLog, SortFilter, StatusFilter } from "./types";
import { getActorSearchLabel, getLogLabel, stringifyForSearch } from "./utils.ts";

export function buildUnifiedLogs(data: AdminLogsRecordCollections): NormalizedLog[] {
  const normalizedProduct = data.productLogs.map((log) => {
    const actorSearchLabel = getActorSearchLabel({
      actorType: log.actor_type,
      actorMmUsername: log.actor_mm_username,
      actorName: log.actor_name,
      actorId: log.actor_id,
      identifier: null,
    });

    return {
      id: log.id,
      group: "product" as const,
      name: String(log.event_name),
      label: getLogLabel("product", String(log.event_name)),
      status: null,
      actorType: log.actor_type ?? null,
      actorId: log.actor_id ?? null,
      actorName: log.actor_name ?? null,
      actorMmUsername: log.actor_mm_username ?? null,
      identifier: null,
      ipAddress: log.ip_address ?? null,
      path: log.path ?? null,
      referrer: log.referrer ?? null,
      targetType: log.target_type ?? null,
      targetId: log.target_id ?? null,
      partnerId: log.target_type === "partner" ? log.target_id ?? null : null,
      partnerName: log.partner_name ?? null,
      properties: log.properties ?? null,
      createdAt: log.created_at,
      actorSearchLabel,
      searchText: [
        log.event_name,
        actorSearchLabel,
        log.actor_name,
        log.actor_mm_username,
        log.actor_type,
        log.actor_id,
        log.ip_address,
        log.path,
        log.referrer,
        log.target_type,
        log.target_id,
        log.partner_name,
        stringifyForSearch(log.properties ?? null),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  const normalizedAudit = data.auditLogs.map((log) => {
    const actorSearchLabel = log.actor_id ?? "admin";
    return {
      id: log.id,
      group: "audit" as const,
      name: String(log.action),
      label: getLogLabel("audit", String(log.action)),
      status: null,
      actorType: "admin",
      actorId: log.actor_id ?? null,
      actorName: null,
      actorMmUsername: null,
      identifier: null,
      ipAddress: log.ip_address ?? null,
      path: log.path ?? null,
      referrer: null,
      targetType: log.target_type ?? null,
      targetId: log.target_id ?? null,
      partnerId: log.target_type === "partner" ? log.target_id ?? null : null,
      partnerName: log.partner_name ?? null,
      properties: log.properties ?? null,
      createdAt: log.created_at,
      actorSearchLabel,
      searchText: [
        log.action,
        log.actor_id,
        log.ip_address,
        log.path,
        log.target_type,
        log.target_id,
        log.partner_name,
        stringifyForSearch(log.properties ?? null),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  const normalizedSecurity = data.securityLogs.map((log) => {
    const actorSearchLabel = getActorSearchLabel({
      actorType: log.actor_type,
      actorMmUsername: log.actor_mm_username,
      actorName: log.actor_name,
      actorId: log.actor_id,
      identifier: log.identifier,
    });

    return {
      id: log.id,
      group: "security" as const,
      name: String(log.event_name),
      label: getLogLabel("security", String(log.event_name)),
      status: log.status ?? null,
      actorType: log.actor_type ?? null,
      actorId: log.actor_id ?? null,
      actorName: log.actor_name ?? null,
      actorMmUsername: log.actor_mm_username ?? null,
      identifier: log.identifier ?? null,
      ipAddress: log.ip_address ?? null,
      path: log.path ?? null,
      referrer: null,
      targetType: null,
      targetId: null,
      partnerId: null,
      partnerName: null,
      properties: log.properties ?? null,
      createdAt: log.created_at,
      actorSearchLabel,
      searchText: [
        log.event_name,
        log.status,
        actorSearchLabel,
        log.actor_name,
        log.actor_mm_username,
        log.actor_type,
        log.actor_id,
        log.identifier,
        log.ip_address,
        log.path,
        stringifyForSearch(log.properties ?? null),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  return [...normalizedProduct, ...normalizedAudit, ...normalizedSecurity];
}

export function getAvailableLogNames(unifiedLogs: NormalizedLog[], groupFilter: GroupFilter) {
  const names = unifiedLogs
    .filter((log) => groupFilter === "all" || log.group === groupFilter)
    .map((log) => ({ value: log.name, label: log.label }));
  return Array.from(new Map(names.map((item) => [item.value, item])).values()).sort(
    (a, b) => a.label.localeCompare(b.label, "ko-KR"),
  );
}

export function getActorOptions(unifiedLogs: NormalizedLog[]) {
  return Array.from(
    new Set(
      unifiedLogs
        .map((log) => log.actorType)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b, "ko-KR"));
}

export function filterAndSortLogs({
  unifiedLogs,
  searchValue,
  groupFilter,
  nameFilter,
  actorFilter,
  statusFilter,
  sortFilter,
}: {
  unifiedLogs: NormalizedLog[];
  searchValue: string;
  groupFilter: GroupFilter;
  nameFilter: string;
  actorFilter: "all" | string;
  statusFilter: StatusFilter;
  sortFilter: SortFilter;
}) {
  const query = searchValue.trim().toLowerCase();
  const next = unifiedLogs.filter((log) => {
    if (groupFilter !== "all" && log.group !== groupFilter) {
      return false;
    }
    if (actorFilter !== "all" && log.actorType !== actorFilter) {
      return false;
    }
    if (statusFilter !== "all" && log.status !== statusFilter) {
      return false;
    }
    if (nameFilter !== "all" && log.name !== nameFilter) {
      return false;
    }
    if (query && !log.searchText.includes(query)) {
      return false;
    }
    return true;
  });

  next.sort((a, b) => {
    if (sortFilter === "oldest") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortFilter === "actor") {
      return a.actorSearchLabel.localeCompare(b.actorSearchLabel, "ko-KR");
    }
    if (sortFilter === "ip") {
      return (a.ipAddress ?? "").localeCompare(b.ipAddress ?? "", "ko-KR");
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return next;
}

function buildTopList(entries: Array<[string, number]>) {
  return entries
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value: `${value}건` }));
}

export function createTopProductEvents(data: AdminLogsRecordCollections) {
  const counts = new Map<string, number>();
  data.productLogs.forEach((log) => {
    const key = String(log.event_name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return buildTopList(
    Array.from(counts.entries()).map(([key, value]) => [
      getLogLabel("product", key),
      value,
    ]),
  );
}

export function createTopAuditActions(data: AdminLogsRecordCollections) {
  const counts = new Map<string, number>();
  data.auditLogs.forEach((log) => {
    const key = String(log.action);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return buildTopList(
    Array.from(counts.entries()).map(([key, value]) => [
      getLogLabel("audit", key),
      value,
    ]),
  );
}

export function createTopActors(unifiedLogs: NormalizedLog[]) {
  const counts = new Map<string, number>();
  unifiedLogs.forEach((log) => {
    const key = log.actorSearchLabel;
    if (!key || key === "비로그인 사용자") {
      return;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return buildTopList(Array.from(counts.entries()));
}

export function createTopIps(unifiedLogs: NormalizedLog[]) {
  const counts = new Map<string, number>();
  unifiedLogs.forEach((log) => {
    if (!log.ipAddress) {
      return;
    }
    counts.set(log.ipAddress, (counts.get(log.ipAddress) ?? 0) + 1);
  });
  return buildTopList(Array.from(counts.entries()));
}

export function createTopPaths(unifiedLogs: NormalizedLog[]) {
  const counts = new Map<string, number>();
  unifiedLogs.forEach((log) => {
    if (!log.path) {
      return;
    }
    counts.set(log.path, (counts.get(log.path) ?? 0) + 1);
  });
  return buildTopList(Array.from(counts.entries()));
}

export function getSecurityStatusCounts(data: AdminLogsRecordCollections) {
  return {
    success: data.securityLogs.filter((log) => log.status === "success").length,
    failure: data.securityLogs.filter((log) => log.status === "failure").length,
    blocked: data.securityLogs.filter((log) => log.status === "blocked").length,
  };
}
