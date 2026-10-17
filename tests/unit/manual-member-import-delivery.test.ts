import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImportRow } from "@/lib/member-manual-import/types";
const mocks = vi.hoisted(() => ({
  intent: vi.fn(), attempt: vi.fn(), sent: vi.fn(), ensureToken: vi.fn(),
  email: vi.fn(), emailConfig: vi.fn(), sender: vi.fn(), direct: vi.fn(),
}));
vi.mock("@/lib/email-delivery", () => ({ getEmailDeliveryConfig: mocks.emailConfig, sendTransactionalEmail: mocks.email }));
vi.mock("@/lib/member-password-action-email", () => ({ buildMemberPasswordSetupUrl: () => "https://fixture.invalid/setup" }));
vi.mock("@/lib/mattermost-senders/service", () => ({ withActiveMattermostSenderForGeneration: mocks.sender }));
vi.mock("@/lib/notification-templates/repository.server", () => ({ resolveNotificationTemplate: async () => ({ titleTemplate: "title", bodyTemplate: "body", eventKey: "email.manual_member_setup" }) }));
vi.mock("@/lib/notification-templates/template", () => ({ renderNotificationTemplate: () => "테스트 안내" }));
vi.mock("@/lib/notification-email-content", () => ({ renderResolvedNotificationEmailContent: () => ({ text: "테스트 안내", html: "<p>테스트 안내</p>" }) }));
vi.mock("@/lib/member-manual-import/password-actions.server", () => ({ ensureManualMemberImportPasswordAction: mocks.ensureToken }));
vi.mock("@/lib/member-manual-import/repository.supabase", () => ({ checkpointManualMemberImportDeliveryIntent: mocks.intent, checkpointManualMemberImportDeliveryAttempt: mocks.attempt, checkpointManualMemberImportDeliverySent: mocks.sent }));
import { deliverManualMemberImportSetup } from "@/lib/member-manual-import/delivery.server";
import { ManualMemberImportDeliveryOutcomeUnknownError } from "@/lib/member-manual-import/errors";
const row = { id: "11111111-1111-1111-1111-111111111111", delivery_channel: null, delivery_idempotency_key: null, delivery_attempted_at: null, delivery_sent_at: null, email_normalized: "fixture@example.test" } as ImportRow;
const input = () => ({ row, memberId: "member", displayName: "테스트 회원", resolvedMattermostMember: null, rowLeaseVersion: "v1", onRowLeaseUpdated: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.intent.mockResolvedValue({ rowLeaseVersion: "v2", deliveryIdempotencyKey: `manual-member-import-setup:${row.id}` });
  mocks.attempt.mockResolvedValue({ rowLeaseVersion: "v3" });
  mocks.sent.mockResolvedValue({ rowLeaseVersion: "v4" });
  mocks.ensureToken.mockResolvedValue("synthetic-token");
  mocks.email.mockResolvedValue(undefined);
  mocks.emailConfig.mockReturnValue({});
  mocks.sender.mockImplementation(async (_generation, send) => send({ sendDirectMessage: mocks.direct }));
  mocks.direct.mockResolvedValue(undefined);
});

describe("manual import durable delivery", () => {
  it("sends once after durable intent and attempt, then advances the lease from the sent checkpoint", async () => {
    const data = input();
    expect(await deliverManualMemberImportSetup(data)).toEqual({ deliveryChannel: "email", rowLeaseVersion: "v4" });
    expect(mocks.intent).toHaveBeenCalledWith(expect.objectContaining({ rowLeaseVersion: "v1", deliveryChannel: "email" }));
    expect(mocks.attempt).toHaveBeenCalledWith(expect.objectContaining({ rowLeaseVersion: "v2" }));
    expect(mocks.sent).toHaveBeenCalledWith(expect.objectContaining({ rowLeaseVersion: "v3" }));
    expect(data.onRowLeaseUpdated.mock.calls).toEqual([["v2"], ["v3"], ["v4"]]);
    expect(mocks.email).toHaveBeenCalledWith(expect.objectContaining({ to: "fixture@example.test", idempotencyKey: `manual-member-import-setup:${row.id}`, messageId: `<manual-member-import-setup-${row.id}@ssartnership.local>` }));
    expect(mocks.attempt.mock.invocationCallOrder[0]).toBeLessThan(mocks.email.mock.invocationCallOrder[0]);
    expect(mocks.email.mock.invocationCallOrder[0]).toBeLessThan(mocks.sent.mock.invocationCallOrder[0]);
  });

  it("does not resend a recorded success and refuses an interrupted delivery attempt", async () => {
    const data = { ...input(), row: { ...row, delivery_channel: "email" as const, delivery_idempotency_key: `manual-member-import-setup:${row.id}`, delivery_sent_at: "sent" } };
    expect(await deliverManualMemberImportSetup(data)).toEqual({ deliveryChannel: "email", rowLeaseVersion: "v1" });
    await expect(deliverManualMemberImportSetup({ ...data, row: { ...data.row, delivery_sent_at: null, delivery_attempted_at: "attempt" } })).rejects.toBeInstanceOf(ManualMemberImportDeliveryOutcomeUnknownError);
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.ensureToken).not.toHaveBeenCalled();
    expect(mocks.attempt).not.toHaveBeenCalled();
  });

  it("does not claim an email attempt when static provider configuration is unavailable", async () => {
    mocks.emailConfig.mockImplementationOnce(() => { throw new Error("unconfigured"); });
    await expect(deliverManualMemberImportSetup(input())).rejects.toThrow("unconfigured");
    expect(mocks.attempt).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("treats a provider failure or failed sent checkpoint as unknown without silently retrying", async () => {
    mocks.email.mockRejectedValueOnce(new Error("provider failed after accept"));
    await expect(deliverManualMemberImportSetup(input())).rejects.toBeInstanceOf(ManualMemberImportDeliveryOutcomeUnknownError);
    expect(mocks.sent).not.toHaveBeenCalled();
    mocks.sent.mockRejectedValueOnce(new Error("checkpoint unavailable"));
    await expect(deliverManualMemberImportSetup(input())).rejects.toBeInstanceOf(ManualMemberImportDeliveryOutcomeUnknownError);
    expect(mocks.email).toHaveBeenCalledTimes(2);
  });

  it("uses the resolved immutable MM recipient and never falls back to email after an attempted MM send", async () => {
    mocks.direct.mockRejectedValueOnce(new Error("unknown MM outcome"));
    await expect(deliverManualMemberImportSetup({ ...input(), resolvedMattermostMember: { displayName: "회원", mattermostAccountId: "account", mattermostUserId: "immutable-id", resolvedGeneration: 16 } })).rejects.toBeInstanceOf(ManualMemberImportDeliveryOutcomeUnknownError);
    expect(mocks.sender).toHaveBeenCalledWith(16, expect.any(Function));
    expect(mocks.direct).toHaveBeenCalledWith("immutable-id", expect.any(String));
    expect(mocks.email).not.toHaveBeenCalled();
    expect(mocks.sent).not.toHaveBeenCalled();
  });
});
