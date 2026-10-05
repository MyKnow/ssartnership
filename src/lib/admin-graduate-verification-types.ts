export type AdminGraduateVerificationRequest = {
  id: string;
  email: string;
  legal_name: string;
  inferred_generation: number | null;
  inferred_cohort?: number | null;
  campus: string | null;
  request_kind: "graduate_signup" | "existing_member_recovery";
  recovery_member_id: string | null;
  status: string;
  profile_image_id: string | null;
  created_at: string;
};

export type AdminGraduateSetupEmailRetry = {
  id: string;
  email: string;
  legal_name: string;
  setup_email_last_error_at: string | null;
};

export type QueuePaginationState = {
  totalCount: number;
  page: number;
  pageSize: number;
};
