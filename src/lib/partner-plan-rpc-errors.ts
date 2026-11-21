/**
 * Maps partner plan billing RPC errors (`raise exception '<token>'`) to output
 * that may cross the user boundary.
 *
 * - `partner` mappers return messages from the partner plan safe-message
 *   allowlist (`partner-plan-safe-messages.ts`); anything else is replaced by
 *   the generic fallback before it reaches the partner portal.
 * - `admin` mappers return admin action error codes registered in
 *   `admin-action-errors.ts`; free text would be dropped by
 *   `getSafeAdminActionErrorCode`.
 *
 * `tests/partner-plan-rpc-errors.test.mts` checks every rule output and
 * fallback against its allowlist so the two cannot drift.
 */

export type PartnerPlanRpcError = {
  code?: string | null;
  message?: string | null;
};

export type PartnerPlanRpcErrorRule = {
  /** RPC exception tokens or index names; any substring match applies. */
  tokens: readonly string[];
  /** Optional SQLSTATE that must match together with a token. */
  sqlState?: string;
  output: string;
};

export type PartnerPlanRpcErrorMapper = {
  audience: "partner" | "admin";
  rules: readonly PartnerPlanRpcErrorRule[];
  fallback: string;
};

export const PARTNER_PLAN_RPC_ERROR_MAPPERS = {
  createUpgradeBilling: {
    audience: "partner",
    rules: [
      {
        tokens: ["partner_plan_upgrade_requests_pending_partner_idx"],
        sqlState: "23505",
        output: "이미 처리 대기 중인 업그레이드 요청이 있습니다.",
      },
      {
        tokens: ["partner_plan_billing_access_denied"],
        output: "파트너사 접근 권한이 없습니다.",
      },
      {
        tokens: ["partner_plan_billing_partner_not_found"],
        output: "제휴처를 찾을 수 없습니다.",
      },
      {
        tokens: ["partner_plan_billing_profile_not_found"],
        output: "프로필 탭에서 입금자와 세금계산서 정보를 먼저 저장해 주세요.",
      },
      {
        tokens: [
          "partner_plan_billing_state_changed",
          "partner_plan_billing_profile_changed",
        ],
        output: "플랜 또는 청구 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.",
      },
      {
        tokens: ["partner_plan_billing_invalid_request"],
        output: "플랜 청구 정보를 확인해 주세요.",
      },
    ],
    fallback: "플랜 업그레이드 요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  },
  partnerCancelUpgradeBilling: {
    audience: "partner",
    rules: [
      {
        tokens: ["partner_plan_cancel_request_state_conflict"],
        output: "이미 처리된 업그레이드 요청입니다.",
      },
      {
        tokens: ["partner_plan_cancel_paid_invoice_conflict"],
        output: "입금 확인이 완료된 청구는 취소할 수 없습니다.",
      },
    ],
    fallback: "업그레이드 요청을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  },
  adminRejectUpgradeBilling: {
    audience: "admin",
    rules: [
      {
        tokens: ["partner_plan_cancel_request_state_conflict"],
        output: "partner_company_plan_processed",
      },
      {
        tokens: ["partner_plan_cancel_paid_invoice_conflict"],
        output: "partner_company_plan_rejection_paid",
      },
    ],
    fallback: "partner_company_plan_invalid_request",
  },
  adminConfirmBankTransfer: {
    audience: "admin",
    rules: [
      {
        tokens: ["partner_plan_payment_request_state_conflict"],
        output: "partner_company_plan_processed",
      },
      {
        tokens: ["partner_plan_payment_invoice_not_found"],
        output: "partner_company_plan_invoice_missing",
      },
      {
        tokens: ["partner_plan_payment_invoice_cancelled"],
        output: "partner_company_plan_invoice_cancelled",
      },
    ],
    fallback: "partner_company_plan_payment_confirm_failed",
  },
  adminApproveUpgrade: {
    audience: "admin",
    rules: [
      {
        tokens: ["partner_plan_approval_request_state_conflict"],
        output: "partner_company_plan_processed",
      },
      {
        tokens: ["partner_plan_approval_invoice_not_found"],
        output: "partner_company_plan_invoice_missing",
      },
      {
        tokens: ["partner_plan_approval_invoice_unpaid_conflict"],
        output: "partner_company_plan_payment_unconfirmed",
      },
      {
        tokens: ["partner_plan_approval_partner_not_found"],
        output: "partner_company_plan_partner_missing",
      },
      {
        tokens: ["partner_plan_approval_partner_state_conflict"],
        output: "partner_company_plan_state_changed",
      },
    ],
    fallback: "partner_company_plan_approval_failed",
  },
  adminPlanUpdate: {
    audience: "admin",
    rules: [
      {
        tokens: [
          "partner_plan_admin_update_partner_not_found",
          "partner_plan_admin_update_company_required",
        ],
        output: "partner_company_plan_company_required",
      },
      {
        tokens: ["partner_plan_admin_update_state_changed"],
        output: "partner_company_plan_state_changed",
      },
      {
        tokens: ["partner_plan_admin_update_pending_request"],
        output: "partner_company_plan_pending_exists",
      },
      {
        tokens: ["partner_plan_admin_update_invalid_window"],
        output: "partner_company_plan_invalid_request",
      },
    ],
    fallback: "partner_company_plan_update_failed",
  },
} as const satisfies Record<string, PartnerPlanRpcErrorMapper>;

export type PartnerPlanRpcErrorMapperKey =
  keyof typeof PARTNER_PLAN_RPC_ERROR_MAPPERS;

export function mapPartnerPlanRpcError(
  mapperKey: PartnerPlanRpcErrorMapperKey,
  error: PartnerPlanRpcError,
): string {
  const mapper: PartnerPlanRpcErrorMapper =
    PARTNER_PLAN_RPC_ERROR_MAPPERS[mapperKey];
  const message = error.message ?? "";
  for (const rule of mapper.rules) {
    if (rule.sqlState && error.code !== rule.sqlState) {
      continue;
    }
    if (rule.tokens.some((token) => message.includes(token))) {
      return rule.output;
    }
  }
  return mapper.fallback;
}
