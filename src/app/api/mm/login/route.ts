import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { setUserSession } from "@/lib/user-auth";
import { verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      username?: string;
      password?: string;
    };

    const username = String(payload.username ?? "").trim().replace(/^@/, "");
    const password = String(payload.password ?? "").trim();
    if (!username || !password) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: member } = await supabase
      .from("members")
      .select("id,password_hash,password_salt,must_change_password")
      .eq("mm_username", username)
      .maybeSingle();

    if (!member || !member.password_hash || !member.password_salt) {
      return NextResponse.json({ error: "not_registered" }, { status: 401 });
    }

    const ok = verifyPassword(password, member.password_salt, member.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    await setUserSession(member.id, Boolean(member.must_change_password));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "login_failed", message: (error as Error).message },
      { status: 500 },
    );
  }
}
