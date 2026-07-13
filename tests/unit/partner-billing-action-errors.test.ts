import { describe, expect, it } from "vitest";
import { getPartnerBillingActionErrorMessage } from "@/lib/partner-billing-action-errors";

describe("partner billing action error messages", () => {
  it("maps stable server error codes to user-safe messages", () => {
    expect(getPartnerBillingActionErrorMessage("profile_create_failed")).toBe(
      "증빙 프로필을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(getPartnerBillingActionErrorMessage("access_denied")).toBe(
      "선택한 파트너사 계정에 접근할 수 없습니다.",
    );
  });

  it("never decodes or reflects unknown query text", () => {
    expect(getPartnerBillingActionErrorMessage("100% malformed")).toBe(
      "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(getPartnerBillingActionErrorMessage(undefined)).toBeNull();
  });
});
