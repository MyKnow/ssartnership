import { MattermostApiError } from "@/lib/mattermost/client";
import { MattermostSenderUnavailableError } from "@/lib/mattermost-senders/service";

export type MemberProfileSyncErrorCode =
  | "member_lookup_failed"
  | "directory_lookup_failed"
  | "identity_mismatch"
  | "provider_response_invalid"
  | "directory_sync_failed"
  | "profile_image_failed"
  | "member_update_failed"
  | "lifecycle_unresolved"
  | "mattermost_unavailable_mark_failed";

export class MemberProfileSyncError extends Error {
  readonly code: MemberProfileSyncErrorCode;

  constructor(code: MemberProfileSyncErrorCode) {
    super(code);
    this.name = "MemberProfileSyncError";
    this.code = code;
  }
}

export type MemberProfileSyncFailureCode =
  | "member_sync_sender_not_configured"
  | "member_sync_provider_access_denied"
  | "member_sync_provider_rate_limited"
  | "member_sync_provider_not_found"
  | "member_sync_provider_invalid_response"
  | "member_sync_provider_request_rejected"
  | "member_sync_provider_unavailable"
  | "member_sync_identity_mismatch"
  | "member_sync_directory_failed"
  | "member_sync_profile_image_failed"
  | "member_sync_database_failed"
  | "member_sync_provider_lifecycle_unresolved"
  | "member_sync_transition_failed"
  | "member_sync_failed";

/** Maps direct Mattermost failures to non-sensitive, actionable audit codes. */
export function getMemberProfileSyncFailureCode(
  error: unknown,
): MemberProfileSyncFailureCode {
  if (error instanceof MattermostSenderUnavailableError) {
    return "member_sync_sender_not_configured";
  }

  if (error instanceof MattermostApiError) {
    if (error.code === "unauthorized" || error.code === "forbidden") {
      return "member_sync_provider_access_denied";
    }
    if (error.code === "rate_limited") {
      return "member_sync_provider_rate_limited";
    }
    if (error.code === "not_found") {
      return "member_sync_provider_not_found";
    }
    if (error.code === "invalid_response") {
      return "member_sync_provider_invalid_response";
    }
    if (error.code === "request_rejected") {
      return "member_sync_provider_request_rejected";
    }
    return "member_sync_provider_unavailable";
  }

  if (!(error instanceof MemberProfileSyncError)) {
    return "member_sync_failed";
  }

  switch (error.code) {
    case "identity_mismatch":
      return "member_sync_identity_mismatch";
    case "provider_response_invalid":
      return "member_sync_provider_invalid_response";
    case "directory_lookup_failed":
    case "directory_sync_failed":
      return "member_sync_directory_failed";
    case "profile_image_failed":
      return "member_sync_profile_image_failed";
    case "member_lookup_failed":
    case "member_update_failed":
      return "member_sync_database_failed";
    case "lifecycle_unresolved":
      return "member_sync_provider_lifecycle_unresolved";
    case "mattermost_unavailable_mark_failed":
      return "member_sync_transition_failed";
  }
}
