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
  const requestKind = session?.requestKind ?? "graduate_signup";
  if (!session || !challenge || challenge.request_kind !== requestKind) {
    return NextResponse.json({ ok: false, message: "이메일 인증이 필요합니다." }, { status: 401 });
  }
  const { data } = await getSupabaseAdminClient()
    .from("graduate_verification_requests")
    .select("id,status,resubmission_targets,review_note,rejection_reason,legal_name,campus,inferred_generation,inferred_cohort,cohort_rule_version")
    .eq("email_normalized", challenge.email_normalized)
    .eq("request_kind", requestKind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    email: challenge.email_normalized,
    request: data ?? null,
  });
}
