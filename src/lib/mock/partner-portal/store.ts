import type { MockPortalSetupRecord, MockPortalStore } from "./shared.ts";
import { cloneSetupRecord, seededSetups } from "./shared.ts";

const globalScope = globalThis as typeof globalThis & {
  __mockPartnerPortalStore?: MockPortalStore;
};

export function getMockPartnerPortalStore() {
  if (!globalScope.__mockPartnerPortalStore) {
    globalScope.__mockPartnerPortalStore = {
      setups: seededSetups.map(cloneSetupRecord),
    };
  }

  return globalScope.__mockPartnerPortalStore;
}

export function resetMockPartnerPortalStore() {
  delete globalScope.__mockPartnerPortalStore;
}

export function findMockPartnerPortalSetup(token: string) {
  return getMockPartnerPortalStore().setups.find((setup) => setup.token === token) ?? null;
}

export function findMockPartnerPortalAccountByEmail(email: string) {
  return getMockPartnerPortalStore().setups.find((setup) => {
    const normalized = email.trim().toLowerCase();
    return (
      setup.account.loginId.trim().toLowerCase() === normalized ||
      setup.account.email.trim().toLowerCase() === normalized
    );
  }) ?? null;
}

export function findMockPartnerPortalAccountById(accountId: string) {
  return getMockPartnerPortalStore().setups.find(
    (setup) => setup.account.id === accountId,
  ) ?? null;
}

export function listMockPartnerPortalCompanySetups(companyIds: string[]) {
  return getMockPartnerPortalStore().setups.filter((setup) =>
    companyIds.includes(setup.company.id),
  );
}

export function listMockPartnerPortalSetupsInternal(): MockPortalSetupRecord[] {
  return getMockPartnerPortalStore().setups;
}

