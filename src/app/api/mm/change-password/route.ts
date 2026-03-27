import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getUserSession, setUserSession } from "@/lib/user-auth";
import { hashPassword, isValidPassword, verifyPassword } from "@/lib/password";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await getUserSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const payload = (await request.json()) as {
      currentPassword?: string;
      nextPassword?: string;
    };
    const currentPassword = String(payload.currentPassword ?? "").trim();
    const nextPassword = String(payload.nextPassword ?? "").trim();
    if (!currentPassword || !nextPassword) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (!isValidPassword(nextPassword)) {
      return NextResponse.json({ error: "invalid_password" }, { status: 400 });
    }

    const supabase = getSupabaseAdminClient();
    const { data: member } = await supabase
      .from("members")
      .select("id,password_hash,password_salt")
      .eq("id", session.userId)
      .maybeSingle();

    if (!member?.password_hash || !member.password_salt) {
      return NextResponse.json({ error: "wrong_password" }, { status: 400 });
    }

    const ok = verifyPassword(
      currentPassword,
      member.password_salt,
      member.password_hash,
    );
    if (!ok) {
      return NextResponse.json({ error: "wrong_password" }, { status: 400 });
    }

    const record = hashPassword(nextPassword);
    await supabase
      .from("members")
      .update({
        password_hash: record.hash,
        password_salt: record.salt,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.userId);

    await setUserSession(session.userId, false);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "change_failed", message: (error as Error).message },
      { status: 500 },
    );
  }
}
