import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isPartnerBillingProfileVisibleInCompanyScope,
  normalizePartnerBillingProfileFormInput,
  normalizePartnerBillingProfileLabel,
  toPartnerBillingProfileFormValues,
} from "../src/lib/partner-billing-profiles.ts";

describe("partner billing profiles", () => {
  it("normalizes reusable billing profile labels and form values", () => {
    assert.equal(
      normalizePartnerBillingProfileLabel("  본점 세금계산서  "),
      "본점 세금계산서",
    );
    assert.equal(
      normalizePartnerBillingProfileLabel(""),
      "기본 세금계산서 정보",
    );

    assert.deepEqual(
      normalizePartnerBillingProfileFormInput({
        label: "  본점  ",
        payerName: "  카페해온  ",
        businessRegistrationNumber: "220-81-62517",
        businessName: "카페해온",
        representativeName: "김도연",
        businessAddress: "서울 강남구 테헤란로 212",
        businessType: "음식점업",
        businessItem: "커피",
        taxInvoiceEmail: "TAX@EXAMPLE.COM",
        isDefault: true,
      }),
      {
        label: "본점",
        payerName: "카페해온",
        billingProfile: {
          businessRegistrationNumber: "2208162517",
          businessName: "카페해온",
          representativeName: "김도연",
          businessAddress: "서울 강남구 테헤란로 212",
          businessType: "음식점업",
          businessItem: "커피",
          taxInvoiceEmail: "tax@example.com",
        },
        isDefault: true,
      },
    );
  });

  it("exports profile records as form-safe values", () => {
    assert.deepEqual(
      toPartnerBillingProfileFormValues({
        id: "profile-1",
        companyId: "company-1",
        accountId: "account-1",
        label: "본점",
        payerName: "카페해온",
        businessRegistrationNumber: "2208162517",
        businessName: "카페해온",
        representativeName: "김도연",
        businessAddress: "서울 강남구",
        businessType: "음식점업",
        businessItem: "커피",
        taxInvoiceEmail: "tax@example.com",
        taxDocumentType: "tax_invoice",
        isDefault: true,
        lastUsedAt: null,
        archivedAt: null,
        createdAt: "2026-07-03T00:00:00.000Z",
        updatedAt: "2026-07-03T00:00:00.000Z",
      }),
      {
        id: "profile-1",
        label: "본점",
        payerName: "카페해온",
        businessRegistrationNumber: "2208162517",
        businessName: "카페해온",
        representativeName: "김도연",
        businessAddress: "서울 강남구",
        businessType: "음식점업",
        businessItem: "커피",
        taxInvoiceEmail: "tax@example.com",
        isDefault: true,
      },
    );
  });

  it("treats account-owned billing profiles as visible across company scopes", () => {
    assert.equal(
      isPartnerBillingProfileVisibleInCompanyScope(
        {
          accountId: "account-1",
          companyId: "company-a",
          archivedAt: null,
        },
        { accountId: "account-1", companyId: "company-b" },
      ),
      true,
    );
    assert.equal(
      isPartnerBillingProfileVisibleInCompanyScope(
        {
          accountId: null,
          companyId: "company-a",
          archivedAt: null,
        },
        { accountId: "account-1", companyId: "company-b" },
      ),
      false,
    );
    assert.equal(
      isPartnerBillingProfileVisibleInCompanyScope(
        {
          accountId: "account-1",
          companyId: "company-a",
          archivedAt: "2026-07-03T00:00:00.000Z",
        },
        { accountId: "account-1", companyId: "company-b" },
      ),
      false,
    );
  });
});
