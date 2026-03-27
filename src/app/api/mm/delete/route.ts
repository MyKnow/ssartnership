import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getUserSession, clearUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function POST() {
  const session = await getUserSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: member } = await supabase
    .from("members")
    .select("mm_username")
    .eq("id", session.userId)
    .maybeSingle();

  if (member?.mm_username) {
    await supabase
      .from("mm_verification_codes")
      .delete()
      .eq("mm_username", member.mm_username);
    await supabase
      .from("mm_verification_attempts")
      .delete()
      .eq("identifier", member.mm_username);
    await supabase
      .from("password_reset_attempts")
      .delete()
      .eq("identifier", member.mm_username);
  }

  await supabase.from("members").delete().eq("id", session.userId);
  await clearUserSession();

  return NextResponse.json({ ok: true });
}
