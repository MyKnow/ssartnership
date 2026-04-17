import type { PartnerPortalServiceStatus } from "../../partner-dashboard.ts";
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

function normalizeServiceStatus(
  status: "pending" | "approved" | "rejected" | "cancelled",
): PartnerPortalServiceStatus {
  if (status === "pending" || status === "rejected") {
    return status;
  }

  return "approved";
}

export function getMockPartnerChangeRequestPartnerStatuses(
  partnerIds?: string[],
) {
  const uniquePartnerIds = [
    ...new Set((partnerIds ?? []).map((id) => id.trim()).filter(Boolean)),
  ];
  const statusByPartnerId = new Map<string, PartnerPortalServiceStatus>();
  const requests = [...getStore().requests]
    .filter(
      (request) =>
        uniquePartnerIds.length === 0 ||
        uniquePartnerIds.includes(request.partnerId),
    )
    .sort(
      (a, b) =>
        b.updatedAt.localeCompare(a.updatedAt) ||
        b.createdAt.localeCompare(a.createdAt),
    );

  for (const request of requests) {
    if (statusByPartnerId.has(request.partnerId)) {
      continue;
    }

    statusByPartnerId.set(request.partnerId, normalizeServiceStatus(request.status));
  }

  return statusByPartnerId;
}
