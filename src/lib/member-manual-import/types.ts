export type ImportBatchRow = {
  id: string;
  created_by_admin_id: string;
  status: "staging" | "ready" | "processing" | "completed" | "expired";
  expires_at: string;
  updated_at: string;
};

export type ImportRow = {
  id: string;
  batch_id: string;
  status: "staged" | "processing" | "created" | "failed";
  member_id: string | null;
  row_number: number;
  generation: number;
  display_name: string | null;
  campus: string | null;
  mm_username: string | null;
  email: string | null;
  email_normalized: string | null;
  photo_filename: string | null;
  staging_bucket: string | null;
  staging_path: string | null;
  photo_content_type: string | null;
  photo_size_bytes: number | null;
  image_upload_id: string | null;
  photo_sha256: string | null;
  photo_width: number | null;
  photo_height: number | null;
  photo_attached_at: string | null;
  delivery_channel: "mattermost" | "email" | null;
  delivery_attempted_at: string | null;
  delivery_sent_at: string | null;
  delivery_idempotency_key: string | null;
  staging_deleted_at: string | null;
  error_code: string | null;
  error_message: string | null;
  updated_at: string;
};

export type ResolvedMattermostMember = {
  displayName: string;
  mattermostAccountId: string;
  mattermostUserId: string;
  resolvedGeneration: number;
};

export type ManualMemberImportPreflightResult =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      batchId: string;
      expiresAt: string;
    };

export type ManualMemberImportCommitItem = {
  rowNumber: number;
  status: "success" | "failed" | "already_exists";
  name: string | null;
  mmId: string | null;
  email: string | null;
  deliveryChannel: "mattermost" | "email" | null;
  reason: string | null;
  retryable: boolean;
  existingMemberId: string | null;
};

export type ManualMemberImportCommitResult = {
  batchId: string;
  total: number;
  success: number;
  failed: number;
  alreadyExists: number;
  retryableFailures: number;
  items: ManualMemberImportCommitItem[];
};

export type ImportRowLease = {
  id: string;
  updated_at: string;
};

export type ImportMemberCheckpoint = {
  memberId: string;
  rowLeaseVersion: string;
};

export type ImportRowCheckpoint = {
  rowLeaseVersion: string;
};

export type ManualMemberImportResultRow = Pick<
  ImportRow,
  | "row_number"
  | "status"
  | "display_name"
  | "mm_username"
  | "email_normalized"
  | "delivery_channel"
  | "error_code"
  | "error_message"
>;

export type ImportRowDeliveryIntent = ImportRowCheckpoint & { deliveryIdempotencyKey: string };

export type ManualMemberImportReissueMember = {
  id: string;
  display_name: string | null;
  mattermost_account_id: string | null;
  email_normalized: string | null;
  generation: number | null;
  staff_source_generation: number | null;
  must_change_password: boolean;
};
