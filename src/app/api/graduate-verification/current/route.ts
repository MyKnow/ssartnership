import { NextResponse } from "next/server";
import { getGraduateApplicationSession } from "@/lib/graduate-verification-security";
import { getVerifiedGraduateApplicationChallenge } from "@/lib/graduate-verification-service";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const session = await getGraduateApplicationSession();
  const challenge = session
    ? await getVerifiedGraduateApplicationChallenge(session.challengeId)
    : null;
  if (!session || !challenge) {
    return NextResponse.json({ ok: false, message: "이메일 인증이 필요합니다." }, { status: 401 });
  }
  const { data } = await getSupabaseAdminClient()
    .from("graduate_verification_requests")
    .select("id,status,resubmission_targets,review_note,rejection_reason,legal_name,completion_stage,education_start_year,education_start_month,education_end_year,education_end_month,campus,inferred_cohort")
    .eq("email_normalized", challenge.email_normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    email: challenge.email_normalized,
    request: data ?? null,
  });
}
