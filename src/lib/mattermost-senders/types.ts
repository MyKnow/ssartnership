import type {
  EncryptedMattermostSenderCredentials,
  MattermostSenderCredentials,
} from "./crypto";
import type { MattermostSenderTestRecipientKind } from "./routing";

export const MATTERMOST_SENDER_STATUSES = [
  "pending",
  "active",
  "superseded",
  "disabled",
] as const;

export type MattermostSenderStatus = (typeof MATTERMOST_SENDER_STATUSES)[number];

export type MattermostSenderSafeErrorCode =
  | "test_target_unavailable"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "not_found"
  | "unavailable"
  | "timeout"
  | "invalid_response"
  | "request_rejected"
  | "configuration_invalid";

export type MattermostSenderMetadata = {
  id: string;
  generation: number;
  status: MattermostSenderStatus;
  loginIdHint: string;
  senderUsernameHint: string | null;
  verifiedAt: string | null;
  lastTestedAt: string | null;
  lastTestTargetKind: MattermostSenderTestRecipientKind | null;
  lastErrorCode: MattermostSenderSafeErrorCode | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MattermostSenderEncryptedRecord = MattermostSenderMetadata & {
  encryptedCredentials: EncryptedMattermostSenderCredentials;
  senderMattermostUserId: string | null;
  senderMattermostUsername: string | null;
};

export type ActiveMattermostSender = {
  id: string;
  generation: number;
  credentials: MattermostSenderCredentials;
  senderMattermostUserId: string;
  senderMattermostUsername: string | null;
};

export type MattermostSenderTestContext = {
  previousGenerationSenderUserId: string | null;
  superAdminMattermostUserId: string | null;
};
