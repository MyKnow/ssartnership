import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { hashCode } from "@/lib/mm-verification";
import { setUserSession } from "@/lib/user-auth";
import { hashPassword, isValidPassword } from "@/lib/password";
import {
  normalizeMmUsername,
  PASSWORD_POLICY_MESSAGE,
  validateMmUsername,
} from "@/lib/validation";

export const runtime = "nodejs";

const MAX_FAILS = 5;
const BLOCK_MINUTES = 60;

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      username?: string;
      code?: string;
      password?: string;
    };

    const username = normalizeMmUsername(String(payload.username ?? ""));
    const code = String(payload.code ?? "").trim().toUpperCase();
    const password = String(payload.password ?? "").trim();
    if (!username || !code || !password) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (validateMmUsername(username)) {
      return NextResponse.json({ error: "invalid_username" }, { status: 400 });
    }
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: "invalid_password", message: PASSWORD_POLICY_MESSAGE },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdminClient();

    const { data: attempt } = await supabase
      .from("mm_verification_attempts")
      .select("id,count,blocked_until,first_attempt_at")
      .eq("identifier", username)
      .maybeSingle();

    if (attempt?.blocked_until) {
      const blockedUntil = new Date(attempt.blocked_until);
      if (blockedUntil > new Date()) {
        return NextResponse.json({ error: "blocked" }, { status: 429 });
      }
    }

    const { data: codeRow } = await supabase
      .from("mm_verification_codes")
      .select("*")
      .eq("mm_username", username)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!codeRow) {
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }

    if (new Date(codeRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "expired" }, { status: 400 });
    }

    if (codeRow.code_hash !== hashCode(code)) {
      const nextCount = (attempt?.count ?? 0) + 1;
      const firstAttemptAt = attempt?.first_attempt_at ?? new Date().toISOString();
      const blockedUntil =
        nextCount >= MAX_FAILS
          ? new Date(Date.now() + BLOCK_MINUTES * 60 * 1000).toISOString()
          : null;

      if (attempt?.id) {
        await supabase
          .from("mm_verification_attempts")
          .update({
            count: nextCount,
            blocked_until: blockedUntil,
            first_attempt_at: firstAttemptAt,
          })
          .eq("id", attempt.id);
      } else {
        await supabase.from("mm_verification_attempts").insert({
          identifier: username,
          count: nextCount,
          blocked_until: blockedUntil,
          first_attempt_at: firstAttemptAt,
        });
      }

      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }

    const { data: member } = await supabase
      .from("members")
      .select("id")
      .eq("mm_username", codeRow.mm_username)
      .maybeSingle();

    const upsertPayload = {
      email: codeRow.email ?? null,
      mm_user_id: codeRow.mm_user_id,
      mm_username: codeRow.mm_username,
      display_name: codeRow.display_name,
      region: codeRow.region,
      campus: codeRow.campus,
      class_number: codeRow.class_number,
      avatar_content_type: codeRow.avatar_content_type,
      avatar_base64: codeRow.avatar_base64,
      must_change_password: false,
      updated_at: new Date().toISOString(),
    };

    const passwordRecord = hashPassword(password);

    if (member?.id) {
      await supabase
        .from("members")
        .update({
          ...upsertPayload,
          password_hash: passwordRecord.hash,
          password_salt: passwordRecord.salt,
        })
        .eq("id", member.id);
      await setUserSession(member.id, false);
    } else {
      const { data: inserted } = await supabase
        .from("members")
        .insert({
          ...upsertPayload,
          password_hash: passwordRecord.hash,
          password_salt: passwordRecord.salt,
        })
        .select("id")
        .single();
      if (inserted?.id) {
        await setUserSession(inserted.id, false);
      }
    }

    await supabase.from("mm_verification_attempts").delete().eq("identifier", username);
    await supabase.from("mm_verification_codes").delete().eq("mm_username", username);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "verify_failed", message: (error as Error).message },
      { status: 500 },
    );
  }
}
