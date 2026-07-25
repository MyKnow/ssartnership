import type {
  AdminGraduateSetupEmailRetry,
  AdminGraduateVerificationRequest,
} from "@/components/admin/AdminGraduateVerificationQueue";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AdminGraduateQueuePagination = {
  totalCount: number;
  page: number;
  pageSize: number;
};

function emptyPagination(page: number, pageSize: number): AdminGraduateQueuePagination {
  return { totalCount: 0, page, pageSize };
}

function pageRange(page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return { start, end: start + pageSize - 1 };
}

/**
 * Page-sized read model for the graduate-verification operating queues.
 * The route owns only permission, URL canonicalization, feedback, and actions.
 */
export async function getAdminGraduateVerificationQueueReadModel({
  requestPage,
  requestPageSize,
  setupEmailRetryPage,
  setupEmailRetryPageSize,
}: {
  requestPage: number;
  requestPageSize: number;
  setupEmailRetryPage: number;
  setupEmailRetryPageSize: number;
}) {
  const requestPagination = emptyPagination(requestPage, requestPageSize);
  const setupEmailRetryPagination = emptyPagination(
    setupEmailRetryPage,
    setupEmailRetryPageSize,
  );

  try {
    const supabase = getSupabaseAdminClient();
    const requestRange = pageRange(requestPage, requestPageSize);
    const setupEmailRetryRange = pageRange(
      setupEmailRetryPage,
      setupEmailRetryPageSize,
    );
    const [requestsResult, setupEmailRetriesResult] = await Promise.all([
      supabase
        .from("graduate_verification_requests")
        .select(
          "id,email,legal_name,education_start_year,education_start_month,education_end_year,education_end_month,inferred_generation,campus,request_kind,recovery_member_id,status,profile_image_id,created_at",
          { count: "exact" },
        )
        .in("status", ["submitted", "in_review"])
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(requestRange.start, requestRange.end),
      supabase
        .from("graduate_verification_requests")
        .select("id,email,legal_name,setup_email_last_error_at", {
          count: "exact",
        })
        .eq("status", "approved")
        .not("setup_email_last_error_at", "is", null)
        .order("setup_email_last_error_at", { ascending: false })
        .order("id", { ascending: false })
        .range(setupEmailRetryRange.start, setupEmailRetryRange.end),
    ]);

    if (requestsResult.error || setupEmailRetriesResult.error) {
      return {
        requests: [] as AdminGraduateVerificationRequest[],
        setupEmailRetries: [] as AdminGraduateSetupEmailRetry[],
        requestPagination,
        setupEmailRetryPagination,
        queueLoadError: true,
      };
    }

    return {
      requests: (requestsResult.data ?? []) as AdminGraduateVerificationRequest[],
      setupEmailRetries: (setupEmailRetriesResult.data ??
        []) as AdminGraduateSetupEmailRetry[],
      requestPagination: {
        ...requestPagination,
        totalCount: requestsResult.count ?? 0,
      },
      setupEmailRetryPagination: {
        ...setupEmailRetryPagination,
        totalCount: setupEmailRetriesResult.count ?? 0,
      },
      queueLoadError: false,
    };
  } catch {
    return {
      requests: [] as AdminGraduateVerificationRequest[],
      setupEmailRetries: [] as AdminGraduateSetupEmailRetry[],
      requestPagination,
      setupEmailRetryPagination,
      queueLoadError: true,
    };
  }
}
