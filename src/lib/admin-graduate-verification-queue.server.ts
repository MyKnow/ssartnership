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

export type AdminGraduateVerificationRequestQueueReadModel = {
  requests: AdminGraduateVerificationRequest[];
  requestPagination: AdminGraduateQueuePagination;
  queueLoadError: boolean;
};

export type AdminGraduateSetupEmailRetryQueueReadModel = {
  setupEmailRetries: AdminGraduateSetupEmailRetry[];
  setupEmailRetryPagination: AdminGraduateQueuePagination;
  queueLoadError: boolean;
};

function emptyPagination(page: number, pageSize: number): AdminGraduateQueuePagination {
  return { totalCount: 0, page, pageSize };
}

function pageRange(page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return { start, end: start + pageSize - 1 };
}

export async function getAdminGraduateVerificationRequestQueueReadModel({
  requestPage,
  requestPageSize,
}: {
  requestPage: number;
  requestPageSize: number;
}): Promise<AdminGraduateVerificationRequestQueueReadModel> {
  const requestPagination = emptyPagination(requestPage, requestPageSize);

  try {
    const supabase = getSupabaseAdminClient();
    const requestRange = pageRange(requestPage, requestPageSize);
    const requestsResult = await supabase
      .from("graduate_verification_requests")
      .select(
        "id,email,legal_name,education_start_year,education_start_month,education_end_year,education_end_month,inferred_generation,campus,request_kind,recovery_member_id,status,profile_image_id,created_at",
        { count: "exact" },
      )
      .in("status", ["submitted", "in_review"])
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(requestRange.start, requestRange.end);

    if (requestsResult.error) {
      return {
        requests: [],
        requestPagination,
        queueLoadError: true,
      };
    }

    return {
      requests: (requestsResult.data ?? []) as AdminGraduateVerificationRequest[],
      requestPagination: {
        ...requestPagination,
        totalCount: requestsResult.count ?? 0,
      },
      queueLoadError: false,
    };
  } catch {
    return {
      requests: [],
      requestPagination,
      queueLoadError: true,
    };
  }
}

export async function getAdminGraduateSetupEmailRetryQueueReadModel({
  setupEmailRetryPage,
  setupEmailRetryPageSize,
}: {
  setupEmailRetryPage: number;
  setupEmailRetryPageSize: number;
}): Promise<AdminGraduateSetupEmailRetryQueueReadModel> {
  const setupEmailRetryPagination = emptyPagination(
    setupEmailRetryPage,
    setupEmailRetryPageSize,
  );

  try {
    const supabase = getSupabaseAdminClient();
    const setupEmailRetryRange = pageRange(
      setupEmailRetryPage,
      setupEmailRetryPageSize,
    );
    const setupEmailRetriesResult = await supabase
      .from("graduate_verification_requests")
      .select("id,email,legal_name,setup_email_last_error_at", {
        count: "exact",
      })
      .eq("status", "approved")
      .not("setup_email_last_error_at", "is", null)
      .order("setup_email_last_error_at", { ascending: false })
      .order("id", { ascending: false })
      .range(setupEmailRetryRange.start, setupEmailRetryRange.end);

    if (setupEmailRetriesResult.error) {
      return {
        setupEmailRetries: [],
        setupEmailRetryPagination,
        queueLoadError: true,
      };
    }

    return {
      setupEmailRetries: (setupEmailRetriesResult.data ?? []) as AdminGraduateSetupEmailRetry[],
      setupEmailRetryPagination: {
        ...setupEmailRetryPagination,
        totalCount: setupEmailRetriesResult.count ?? 0,
      },
      queueLoadError: false,
    };
  } catch {
    return {
      setupEmailRetries: [],
      setupEmailRetryPagination,
      queueLoadError: true,
    };
  }
}

/**
 * Page-sized read model for the graduate-verification operating queues.
 * The route owns only permission, URL canonicalization, feedback, and actions.
 *
 * Keep this combined reader for callers that need both queues at once. The
 * main admin page uses the two focused readers above so its primary review
 * queue can stream before the ancillary retry queue finishes.
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
  const [requestQueue, setupEmailRetryQueue] = await Promise.all([
    getAdminGraduateVerificationRequestQueueReadModel({
      requestPage,
      requestPageSize,
    }),
    getAdminGraduateSetupEmailRetryQueueReadModel({
      setupEmailRetryPage,
      setupEmailRetryPageSize,
    }),
  ]);

  return {
    requests: requestQueue.requests,
    setupEmailRetries: setupEmailRetryQueue.setupEmailRetries,
    requestPagination: requestQueue.requestPagination,
    setupEmailRetryPagination: setupEmailRetryQueue.setupEmailRetryPagination,
    queueLoadError:
      requestQueue.queueLoadError || setupEmailRetryQueue.queueLoadError,
  };
}
