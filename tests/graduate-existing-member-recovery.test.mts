import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("기존 회원 복구는 신규 수료생 가입과 별도 request kind로 전파된다", () => {
  const domain = read("src/lib/graduate-verification.ts");
  const sendRoute = read("src/app/api/graduate-verification/email/send/route.ts");
  const verifyRoute = read("src/app/api/graduate-verification/email/verify/route.ts");
  const page = read("src/app/auth/signup/graduate/page.tsx");

  assert.match(domain, /"graduate_signup",\s*"existing_member_recovery"/);
  assert.match(sendRoute, /request_kind:\s*requestKind/);
  assert.match(verifyRoute, /\.eq\("request_kind", requestKind\)/);
  assert.match(page, /kind === "recovery" \? "existing_member_recovery"/);
});

test("복구 승인에는 운영자가 선택한 기존 회원만 연결되고 새 members 행을 만들지 않는다", () => {
  const migration = read("supabase/migrations/20260717020528_add_member_email_recovery_and_existing_member_recovery.sql");
  const service = read("src/lib/graduate-verification-service.ts");
  const queue = read("src/components/admin/AdminGraduateVerificationQueue.tsx");
  const actions = read("src/app/admin/(protected)/graduate-verifications/actions.ts");

  assert.match(migration, /if request_row\.request_kind = 'existing_member_recovery' then/i);
  assert.match(migration, /raise exception 'graduate_verification_recovery_member_required'/i);
  assert.match(migration, /update public\.members[\s\S]{0,700}where id = target_member\.id/i);
  assert.match(migration, /elsif request_row\.request_kind = 'graduate_signup' then[\s\S]{0,1000}insert into public\.members/i);
  assert.match(service, /p_existing_member_id/);
  assert.match(service, /기존 회원을 명시적으로 선택해 주세요/);
  assert.match(queue, /name="existingMemberId"/);
  assert.match(actions, /getOptionalId\(formData, "existingMemberId"\)/);
});
