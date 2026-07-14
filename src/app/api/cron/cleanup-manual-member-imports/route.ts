import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { removeGraduateStoredObject } from "@/lib/graduate-verification-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const BATCH_SIZE = 50;

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: NextRequest) {
  if (!await isAdminSession() && !isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();
    const { data: batches, error } = await supabase
      .from("manual_member_import_batches")
      .select("id")
      .neq("status", "expired")
      .lt("expires_at", now)
      .limit(BATCH_SIZE);
    if (error) throw error;
    let expired = 0;
    let removedFiles = 0;
    for (const batch of batches ?? []) {
      const { data: rows } = await supabase
        .from("manual_member_import_rows")
        .select("id,staging_bucket,staging_path")
        .eq("batch_id", batch.id)
        .neq("status", "created")
        .is("staging_deleted_at", null)
        .not("staging_path", "is", null);
      for (const row of rows ?? []) {
        if (!row.staging_bucket || !row.staging_path) continue;
        try {
          await removeGraduateStoredObject(row.staging_bucket, row.staging_path);
          await supabase
            .from("manual_member_import_rows")
            .update({ staging_deleted_at: now })
            .eq("id", row.id);
          removedFiles += 1;
        } catch {
          // Preserve the batch for the next safe cleanup retry.
        }
      }
      await supabase
        .from("manual_member_import_batches")
        .update({ status: "expired" })
        .eq("id", batch.id)
        .neq("status", "completed");
      expired += 1;
    }
    return NextResponse.json({ ok: true, expired, removedFiles, processedAt: now });
  } catch {
    return NextResponse.json({ ok: false, message: "가져오기 임시 파일을 정리하지 못했습니다." }, { status: 500 });
  }
}
