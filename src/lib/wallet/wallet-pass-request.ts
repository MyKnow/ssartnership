import { z } from "zod";

export const APPLE_WALLET_CONSENT_VERSION = 1;

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

export const issueAppleWalletPassRequestSchema = z.object({
  consent: z.literal(true),
  consentVersion: z.literal(APPLE_WALLET_CONSENT_VERSION),
  idempotencyKey: idempotencyKeySchema,
});

export const revokeAppleWalletPassRequestSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  reason: z.literal("member_requested"),
});

export type IssueAppleWalletPassRequest = z.infer<
  typeof issueAppleWalletPassRequestSchema
>;

export type RevokeAppleWalletPassRequest = z.infer<
  typeof revokeAppleWalletPassRequestSchema
>;
