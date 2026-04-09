import { NextResponse } from "next/server";
import { getSignedUserSession } from "@/lib/user-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  getCertificationQrVerificationUrl,
  issueCertificationQrToken,
} from "@/lib/certification-qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSignedUserSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: member } = await supabase
    .from("members")
    .select("id,must_change_password")
    .eq("id", session.userId)
    .maybeSingle();

  if (!member?.id || member.must_change_password) {
    return NextResponse.json({ error: "invalid_member" }, { status: 403 });
  }

  const { token, payload } = issueCertificationQrToken({
    userId: member.id,
  });

  return NextResponse.json({
    token,
    verifyUrl: getCertificationQrVerificationUrl(token),
    issuedAt: new Date(payload.issuedAt).toISOString(),
    expiresAt: new Date(payload.expiresAt).toISOString(),
  });
}
