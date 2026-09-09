import { NextRequest, NextResponse } from "next/server";
import { forEachWithConcurrency } from "@/lib/async-concurrency";
import { ensureCronApiAccess, getCronErrorResponse } from "@/lib/cron-route";
import { removeGraduateStoredObject } from "@/lib/graduate-verification-storage";
import { getRetrySafeExpirableBatchIds } from "@/lib/member-manual-import/cleanup";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const BATCH_SIZE = 50;
const CLEANUP_CONCURRENCY = 8;

export async function GET(request: NextRequest) {
  const denied = ensureCronApiAccess(request);
  if (denied) return denied;
  try {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data: batches, error } = await supabase
      .from("manual_member_import_batches")
      .select("id")
      .neq("status", "expired")
      .neq("status", "completed")
      .lt("expires_at", now)
      .limit(BATCH_SIZE);
    if (error) throw error;
    const batchIds = (batches ?? []).map((batch) => batch.id);
    if (batchIds.length === 0) {
      return NextResponse.json({ ok: true, expired: 0, removedFiles: 0, processedAt: now });
    }

    const { data: rows, error: rowsError } = await supabase
      .from("manual_member_import_rows")
      .select("id,batch_id,staging_bucket,staging_path")
      .in("batch_id", batchIds)
      .neq("status", "created")
      .is("staging_deleted_at", null)
      .not("staging_path", "is", null);
    if (rowsError) throw rowsError;

    let removedFiles = 0;
    const failedBatchIds = new Set<string>();
    await forEachWithConcurrency(rows ?? [], CLEANUP_CONCURRENCY, async (row) => {
      if (!row.staging_bucket || !row.staging_path) return;
      try {
        await removeGraduateStoredObject(row.staging_bucket, row.staging_path);
        const { error: updateError } = await supabase
          .from("manual_member_import_rows")
          .update({ staging_deleted_at: now })
          .eq("id", row.id);
        if (updateError) throw updateError;
        removedFiles += 1;
      } catch {
        failedBatchIds.add(row.batch_id);
      }
    });
    const expirableBatchIds = getRetrySafeExpirableBatchIds(
      batchIds,
      failedBatchIds,
    );
    const expired = expirableBatchIds.length
      ? await supabase
          .from("manual_member_import_batches")
          .update({ status: "expired" })
          .in("id", expirableBatchIds)
          .neq("status", "completed")
          .select("id")
          .then(({ data, error: expireError }) => {
            if (expireError) throw expireError;
            return data?.length ?? 0;
          })
      : 0;
    return NextResponse.json({ ok: true, expired, removedFiles, processedAt: now });
  } catch {
    return getCronErrorResponse("cleanup-manual-member-imports");
  }
}
