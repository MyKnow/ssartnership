import type { PartnerPortalCompanyStatus } from "../../partner-dashboard.ts";
import { getRawMockPartnerChangeRequestStore } from "./shared.ts";
import { normalizeRequestRecord, normalizeServiceRecord } from "./normalizers.ts";

export function getStore() {
  const store = getRawMockPartnerChangeRequestStore();

  store.services = store.services.map((service) => normalizeServiceRecord(service));
  store.requests = store.requests.map((request) =>
    normalizeRequestRecord(
      request,
      store.services.find((service) => service.partnerId === request.partnerId) ?? null,
    ),
  );

  return store;
}

export function findService(partnerId: string) {
  return getStore().services.find((service) => service.partnerId === partnerId) ?? null;
}

export function findRequest(requestId: string) {
  return getStore().requests.find((request) => request.id === requestId) ?? null;
}

export function findPendingRequest(partnerId: string) {
  return (
    getStore().requests.find(
      (request) => request.partnerId === partnerId && request.status === "pending",
    ) ?? null
  );
}

export function findDisplayNameByAccountId(accountId: string) {
  const request = getStore().requests.find(
    (item) => item.requestedByAccountId === accountId,
  );
  return request?.requestedByDisplayName ?? request?.requestedByLoginId ?? null;
}

function normalizeCompanyStatus(
  status: "pending" | "approved" | "rejected" | "cancelled",
): PartnerPortalCompanyStatus {
  if (status === "pending" || status === "rejected") {
    return status;
  }

  return "approved";
}

export function getMockPartnerChangeRequestCompanyStatuses(
  companyIds?: string[],
) {
  const uniqueCompanyIds = [
    ...new Set((companyIds ?? []).map((id) => id.trim()).filter(Boolean)),
  ];
  const statusByCompanyId = new Map<string, PartnerPortalCompanyStatus>();
  const requests = [...getStore().requests]
    .filter(
      (request) =>
        uniqueCompanyIds.length === 0 ||
        uniqueCompanyIds.includes(request.companyId),
    )
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) ||
        b.createdAt.localeCompare(a.createdAt),
    );

  for (const request of requests) {
    if (statusByCompanyId.has(request.companyId)) {
      continue;
    }

    statusByCompanyId.set(request.companyId, normalizeCompanyStatus(request.status));
  }

  return statusByCompanyId;
}
