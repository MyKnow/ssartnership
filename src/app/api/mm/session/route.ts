import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/user-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getUserSession();
  if (!session?.userId) {
    return NextResponse.json({ userId: null }, { status: 200 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: member } = await supabase
    .from("members")
    .select("mm_username")
    .eq("id", session.userId)
    .maybeSingle();

  return NextResponse.json({
    userId: session.userId,
    mmUsername: member?.mm_username ?? null,
    mustChangePassword: session.mustChangePassword ?? false,
  });
}
