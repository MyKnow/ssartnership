import { beforeEach, describe, expect, test, vi } from "vitest";
import { PartnerMutationOutcomeUnknownError } from "../../src/lib/partner-admin/mutation-outcome";

const {
  createPartnerMock,
  getSupabaseAdminClientMock,
  logAdminActionMock,
  logServerErrorMock,
  revalidateAdminAndPublicPathsMock,
  redirectAdminActionErrorMock,
  rollbackStatusMock,
  sendNewPartnerNotificationMock,
} = vi.hoisted(() => ({
  createPartnerMock: vi.fn(),
  getSupabaseAdminClientMock: vi.fn(),
  logAdminActionMock: vi.fn(),
  logServerErrorMock: vi.fn(),
  revalidateAdminAndPublicPathsMock: vi.fn(),
  redirectAdminActionErrorMock: vi.fn(),
  rollbackStatusMock: vi.fn(),
  sendNewPartnerNotificationMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string): never => { throw new Error(`redirect:${url}`); },
}));
vi.mock("@/lib/admin-access", () => ({
  requireAdminPermission: async () => ({ adminId: "admin-a", account: {} }),
}));
vi.mock("@/lib/admin-scope", () => ({ assertAdminCanAccessManagedCampuses: vi.fn() }));
vi.mock("@/lib/new-partner-notifications", () => ({
  sendAndRecordCampusScopedNewPartnerNotification: sendNewPartnerNotificationMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: getSupabaseAdminClientMock,
}));
vi.mock("@/lib/server-log", () => ({ logServerError: logServerErrorMock }));
vi.mock("@/lib/partner-registration-submit.server", () => ({
  loadPartnerRegistrationCategories: vi.fn(),
}));
vi.mock("@/app/admin/(protected)/_actions/partner-support/company-provision", () => ({
  cleanupPartnerCompanyProvision: vi.fn(),
  ensurePartnerCompanyRow: vi.fn(),
}));
vi.mock("@/app/admin/(protected)/_actions/shared-helpers", () => ({
  logAdminAction: logAdminActionMock,
  revalidateAdminAndPublicPaths: revalidateAdminAndPublicPathsMock,
  redirectAdminActionError: redirectAdminActionErrorMock,
}));
vi.mock("@/lib/partner-registration-conversion.server", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/lib/partner-registration-conversion.server")>();
  return {
    ...original,
    createPartnerFromPortalRegistrationRequest: createPartnerMock,
    rollbackPartnerRegistrationRequestStatus: (...args: Parameters<typeof original.rollbackPartnerRegistrationRequestStatus>) => {
      rollbackStatusMock(...args);
      return original.rollbackPartnerRegistrationRequestStatus(...args);
    },
  };
});

const { PartnerRegistrationConversionCleanupError } = await import(
  "../../src/lib/partner-registration-conversion.server"
);

const { updatePartnerRegistrationRequestStatus } = await import(
  "../../src/app/admin/(protected)/partner-registrations/actions"
);

let request: Record<string, unknown>;
let failRollback: boolean;
const updateReceiptOverrides = new Map<string, unknown>();
const requestUpdates: Array<Record<string, unknown>> = [];
const partner = {
  id: "partner-a",
  name: "테스트 제휴처",
  location: "서울",
  campus_slugs: ["seoul"],
  visibility: "public",
  benefits: [],
};

function createRequestStore() {
  return {
    from(table: string) {
      expect(table).toBe("partner_registration_requests");
      let update: Record<string, unknown> | undefined;
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select: () => builder,
        update(values: Record<string, unknown>) {
          update = values;
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return builder;
        },
        async maybeSingle() {
          if (!filters.every(([column, value]) => request[column] === value)) {
            return { data: null, error: null };
          }
          if (update) {
            if (updateReceiptOverrides.has(String(update.status))) {
              return { data: updateReceiptOverrides.get(String(update.status)), error: null };
            }
            if (failRollback && update.status === "in_review") {
              return { data: null, error: { message: "rollback unavailable" } };
            }
            requestUpdates.push(update);
            Object.assign(request, update);
            return { data: { id: request.id }, error: null };
          }
          return { data: structuredClone(request), error: null };
        },
      };
      return builder;
    },
  };
}

function convert() {
  const formData = new FormData();
  formData.set("id", "request-a");
  formData.set("status", "converted");
  formData.set("visibility", "public");
  return updatePartnerRegistrationRequestStatus(formData);
}

beforeEach(() => {
  vi.resetAllMocks();
  request = {
    id: "request-a", status: "in_review", visibility: "public", company_id: null,
    brand_name: partner.name, location: "서울", category_id: "category-a",
    category_label: "테스트", service_mode: "offline", benefit_action_type: "none",
  };
  requestUpdates.length = 0;
  failRollback = false;
  updateReceiptOverrides.clear();
  getSupabaseAdminClientMock.mockReturnValue(createRequestStore());
  createPartnerMock.mockResolvedValue({ partners: [partner], created: true });
  logAdminActionMock.mockResolvedValue(undefined);
  sendNewPartnerNotificationMock.mockResolvedValue({ sent: true });
  redirectAdminActionErrorMock.mockImplementation((_url: string, code: string): never => { throw new Error(code); });
});

describe("등록 신청 전환의 생성·후속 처리 경계", () => {
  test.each([[], {}, { id: "different-request" }, null, undefined].map((receipt) => [receipt]))("상태 변경의 불완전 응답 %j로는 제휴처 생성을 시작하지 않는다", async (receipt) => {
    updateReceiptOverrides.set("converted", receipt);

    await expect(convert()).rejects.toThrow("redirect:/admin/partner-registrations?success=already-updated");

    expect(request.status).toBe("in_review");
    expect(createPartnerMock).not.toHaveBeenCalled();
    expect(sendNewPartnerNotificationMock).not.toHaveBeenCalled();
  });

  test.each([[], {}, { id: "different-request" }, null, undefined].map((receipt) => [receipt]))("상태 복원의 불완전 응답 %j를 완료로 표시하지 않는다", async (receipt) => {
    createPartnerMock.mockRejectedValue(new Error("known conversion rejection"));
    updateReceiptOverrides.set("in_review", receipt);

    await expect(convert()).rejects.toThrow("partner_form_conversion_status_unrestored");

    expect(request.status).toBe("converted");
    expect(redirectAdminActionErrorMock).toHaveBeenCalledWith(
      "/admin/partner-registrations", "partner_form_conversion_status_unrestored",
      expect.objectContaining({ properties: expect.objectContaining({ statusRestored: false }) }),
    );
  });

  test("생성 후 알림 실패는 등록 완료를 유지하고 실패를 기록한 뒤 생성된 제휴처로 이동한다", async () => {
    const failure = new Error("notification unavailable");
    sendNewPartnerNotificationMock.mockRejectedValue(failure);

    await expect(convert()).rejects.toThrow("redirect:/admin/partners/partner-a");

    expect(request.status).toBe("converted");
    expect(requestUpdates.map((update) => update.status)).toEqual(["converted"]);
    expect(revalidateAdminAndPublicPathsMock).toHaveBeenCalledWith(partner.id);
    expect(logServerErrorMock).toHaveBeenCalledWith(
      "[partner-registration] converted notification failed", failure,
      { requestId: "request-a", partnerId: "partner-a" },
    );
    expect(logAdminActionMock).toHaveBeenCalledWith("partner_update", expect.objectContaining({
      properties: expect.objectContaining({ status: "converted", notificationFailedPartnerIds: [partner.id] }),
    }));
  });

  test("알림 실패 뒤 같은 전환 요청을 다시 보내도 생성과 알림을 반복하지 않는다", async () => {
    sendNewPartnerNotificationMock.mockRejectedValue(new Error("notification unavailable"));
    await expect(convert()).rejects.toThrow("redirect:/admin/partners/partner-a");
    await expect(convert()).rejects.toThrow("redirect:/admin/partner-registrations?success=updated");

    expect(request.status).toBe("converted");
    expect(createPartnerMock).toHaveBeenCalledTimes(1);
    expect(sendNewPartnerNotificationMock).toHaveBeenCalledTimes(1);
  });

  test("여러 제휴처 중 한 알림 실패는 나머지 제휴처의 후속 처리를 막지 않는다", async () => {
    createPartnerMock.mockResolvedValue({
      partners: [partner, { ...partner, id: "partner-b" }], created: true,
    });
    sendNewPartnerNotificationMock.mockRejectedValueOnce(new Error("notification unavailable"));

    await expect(convert()).rejects.toThrow("redirect:/admin/partner-registrations?success=updated");

    expect(request.status).toBe("converted");
    expect(sendNewPartnerNotificationMock).toHaveBeenCalledTimes(2);
    expect(revalidateAdminAndPublicPathsMock).toHaveBeenCalledWith("partner-a");
    expect(revalidateAdminAndPublicPathsMock).toHaveBeenCalledWith("partner-b");
  });

  test("실제 생성 실패는 기존 보상 처리 뒤 신청 상태를 복원한다", async () => {
    createPartnerMock.mockRejectedValue(new Error("conversion rolled back"));

    await expect(convert()).rejects.toThrow("partner_form_conversion_failed");

    expect(request.status).toBe("in_review");
    expect(requestUpdates.map((update) => update.status)).toEqual(["converted", "in_review"]);
    expect(sendNewPartnerNotificationMock).not.toHaveBeenCalled();
  });

  test("생성 실패 뒤 신청 상태 복원이 실패하면 운영 복구 안내를 유지한다", async () => {
    createPartnerMock.mockRejectedValue(new Error("conversion rolled back"));
    failRollback = true;

    await expect(convert()).rejects.toThrow("partner_form_conversion_status_unrestored");

    expect(request.status).toBe("converted");
    expect(sendNewPartnerNotificationMock).not.toHaveBeenCalled();
  });

  test("보상 정리가 불완전하면 상태 복원을 생략하고 재생성을 차단한 채 운영 복구를 안내한다", async () => {
    createPartnerMock.mockRejectedValue(new PartnerRegistrationConversionCleanupError({
      originalError: new Error("benefit insert failed"),
      cleanupError: new Error("partner delete failed"),
    }));

    await expect(convert()).rejects.toThrow("partner_form_conversion_status_unrestored");

    expect(request.status).toBe("converted");
    expect(requestUpdates.map((update) => update.status)).toEqual(["converted"]);
    expect(rollbackStatusMock).not.toHaveBeenCalled();
    expect(sendNewPartnerNotificationMock).not.toHaveBeenCalled();
    expect(redirectAdminActionErrorMock).toHaveBeenCalledWith(
      "/admin/partner-registrations", "partner_form_conversion_status_unrestored",
      expect.objectContaining({ properties: expect.objectContaining({
        cleanupCompleted: false,
        statusRestored: false,
        statusRollbackSkippedReason: "conversion_cleanup_incomplete",
      }) }),
    );

    await expect(convert()).rejects.toThrow("redirect:/admin/partner-registrations?success=updated");
    expect(createPartnerMock).toHaveBeenCalledTimes(1);
    expect(rollbackStatusMock).not.toHaveBeenCalled();
  });

  test("같은 문자열의 일반 제공자 오류는 보상 실패로 오인하지 않는다", async () => {
    createPartnerMock.mockRejectedValue(new Error("partner_registration_conversion_cleanup_failed"));

    await expect(convert()).rejects.toThrow("partner_form_conversion_failed");

    expect(request.status).toBe("in_review");
    expect(rollbackStatusMock).toHaveBeenCalledTimes(1);
  });

  test("쓰기 결과가 불확실하면 자동 복원과 재생성을 차단하고 운영 확인 사유를 기록한다", async () => {
    createPartnerMock.mockRejectedValue(new PartnerMutationOutcomeUnknownError(
      "conversion_partner_insert", new Error("fixture response lost"),
    ));

    await expect(convert()).rejects.toThrow("partner_form_conversion_status_unrestored");
    expect(request.status).toBe("converted");
    expect(requestUpdates.map((update) => update.status)).toEqual(["converted"]);
    expect(rollbackStatusMock).not.toHaveBeenCalled();
    expect(sendNewPartnerNotificationMock).not.toHaveBeenCalled();
    expect(redirectAdminActionErrorMock).toHaveBeenCalledWith(
      "/admin/partner-registrations", "partner_form_conversion_status_unrestored",
      expect.objectContaining({ properties: expect.objectContaining({
        cleanupCompleted: false, statusRestored: false, mutationOutcomeUnknown: true,
        mutationStage: "conversion_partner_insert",
        statusRollbackSkippedReason: "mutation_outcome_unknown",
      }) }),
    );

    await expect(convert()).rejects.toThrow("redirect:/admin/partner-registrations?success=updated");
    expect(createPartnerMock).toHaveBeenCalledTimes(1);
    expect(rollbackStatusMock).not.toHaveBeenCalled();
  });

  test.each(["audit", "cache"])("생성 후 %s 실패도 완료 상태를 되돌리지 않는다", async (stage) => {
    const failure = new Error(`${stage} unavailable`);
    if (stage === "audit") logAdminActionMock.mockRejectedValueOnce(failure);
    else revalidateAdminAndPublicPathsMock.mockImplementationOnce(() => { throw failure; });

    await expect(convert()).rejects.toThrow(failure.message);

    expect(request.status).toBe("converted");
    expect(requestUpdates.map((update) => update.status)).toEqual(["converted"]);
    await expect(convert()).rejects.toThrow("redirect:/admin/partner-registrations?success=updated");
    expect(createPartnerMock).toHaveBeenCalledTimes(1);
  });
});
