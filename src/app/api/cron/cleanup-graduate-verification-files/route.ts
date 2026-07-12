import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";
import { removeGraduateStoredObject } from "@/lib/graduate-verification-storage";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const CLEANUP_BATCH_SIZE = 100;
const UNCONSUMED_UPLOAD_RETENTION_MS = 24 * 60 * 60 * 1000;

function isAuthorizedByCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

type QuarantinedUpload = {
  id: string;
  storage_bucket: string;
  storage_path: string;
};

type CertificateForDeletion = {
  id: string;
  certificate_storage_path: string | null;
};

type ProfileImageForDeletion = {
  id: string;
  storage_path: string;
};

async function deleteQuarantinedUploads(now: Date) {
  const supabase = getSupabaseAdminClient();
  const cutoff = new Date(now.getTime() - UNCONSUMED_UPLOAD_RETENTION_MS).toISOString();
  const { data, error } = await supabase
    .from("graduate_verification_uploads")
    .select("id,storage_bucket,storage_path")
    .is("consumed_at", null)
    .lt("created_at", cutoff)
    .limit(CLEANUP_BATCH_SIZE);
  if (error) throw new Error("격리 업로드를 조회하지 못했습니다.");

  const uploads = (data ?? []) as QuarantinedUpload[];
  let deleted = 0;
  for (const upload of uploads) {
    try {
      await removeGraduateStoredObject(upload.storage_bucket, upload.storage_path);
      await supabase.from("graduate_verification_uploads").delete().eq("id", upload.id);
      deleted += 1;
    } catch {
      // A later cron run retries the same private object. Avoid logging paths or other PII.
    }
  }
  return deleted;
}

async function deleteExpiredCertificates(nowIso: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("graduate_verification_requests")
    .select("id,certificate_storage_path")
    .not("certificate_storage_path", "is", null)
    .is("certificate_deleted_at", null)
    .not("certificate_delete_after", "is", null)
    .lte("certificate_delete_after", nowIso)
    .limit(CLEANUP_BATCH_SIZE);
  if (error) throw new Error("삭제 예정 수료증을 조회하지 못했습니다.");

  const requests = (data ?? []) as CertificateForDeletion[];
  let deleted = 0;
  for (const request of requests) {
    if (!request.certificate_storage_path) continue;
    try {
      await removeGraduateStoredObject("graduate-certificates", request.certificate_storage_path);
      await supabase
        .from("graduate_verification_requests")
        .update({ certificate_deleted_at: nowIso, certificate_storage_path: null })
        .eq("id", request.id)
        .is("certificate_deleted_at", null);
      deleted += 1;
    } catch {
      // Keep the record eligible for a safe retry without exposing a private path.
    }
  }
  return deleted;
}

async function deleteExpiredProfileImages(nowIso: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("member_profile_images")
    .select("id,storage_path")
    .in("status", ["rejected", "superseded"])
    .is("deleted_at", null)
    .not("delete_after", "is", null)
    .lte("delete_after", nowIso)
    .limit(CLEANUP_BATCH_SIZE);
  if (error) throw new Error("삭제 예정 본인 사진을 조회하지 못했습니다.");

  const images = (data ?? []) as ProfileImageForDeletion[];
  let deleted = 0;
  for (const image of images) {
    try {
      await removeGraduateStoredObject("member-profile-images", image.storage_path);
      await supabase
        .from("member_profile_images")
        .update({ deleted_at: nowIso })
        .eq("id", image.id)
        .is("deleted_at", null);
      deleted += 1;
    } catch {
      // Keep the record eligible for a safe retry without exposing a private path.
    }
  }
  return deleted;
}

export async function GET(request: NextRequest) {
  const adminAuthorized = await isAdminSession();
  if (!adminAuthorized && !isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const nowIso = now.toISOString();
    const [quarantinedUploads, certificates, profileImages] = await Promise.all([
      deleteQuarantinedUploads(now),
      deleteExpiredCertificates(nowIso),
      deleteExpiredProfileImages(nowIso),
    ]);
    return NextResponse.json({
      ok: true,
      quarantinedUploads,
      certificates,
      profileImages,
      processedAt: nowIso,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "수료생 인증 파일 정리를 완료하지 못했습니다." },
      { status: 500 },
    );
  }
}
