import type { PartnerBillingProfileRecord } from "../partner-billing-profiles";
const globalScope = globalThis as typeof globalThis & { __mockPartnerBillingProfiles?: PartnerBillingProfileRecord[] };

function createMockSeedProfiles() {
  const createdAt = "2026-07-03T00:00:00.000Z";
  return [
    {
      id: "mock-billing-profile-cafe-ssafy-default",
      companyId: "mock-partner-company-cafe-ssafy",
      accountId: "mock-partner-account-cafe-ssafy",
      label: "카페 싸피 역삼본점",
      payerName: "카페싸피",
      businessRegistrationNumber: "2208162517",
      businessName: "카페싸피",
      representativeName: "김도연",
      businessAddress: "서울 강남구 역삼로 123",
      businessType: "음식점업",
      businessItem: "커피",
      taxInvoiceEmail: "tax@cafessafy.example",
      taxDocumentType: "tax_invoice",
      isDefault: true,
      lastUsedAt: null,
      archivedAt: null,
      createdAt,
      updatedAt: createdAt,
    },
  ] satisfies PartnerBillingProfileRecord[];
}

export function getMockBillingProfiles() {
  if (!globalScope.__mockPartnerBillingProfiles) {
    globalScope.__mockPartnerBillingProfiles = createMockSeedProfiles();
  }
  return globalScope.__mockPartnerBillingProfiles;
}

export function updateMockBillingProfiles(
  updater: (
    profiles: PartnerBillingProfileRecord[],
  ) => PartnerBillingProfileRecord[],
) {
  globalScope.__mockPartnerBillingProfiles = updater(getMockBillingProfiles());
}
