import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("관리자 세션은 좁은 snapshot RPC를 우선 사용하고 rolling deploy fallback을 유지한다", async () => {
  const [accounts, auth, migration] = await Promise.all([
    read("src/lib/admin-accounts.ts"),
    read("src/lib/auth.ts"),
    read("supabase/migrations/20260728032722_optimize_admin_session_read_model.sql"),
  ]);

  assert.match(accounts, /get_admin_session_snapshot/);
  assert.match(accounts, /getAdminAccountFromProfile\(memberId\)/);
  assert.match(accounts, /mapAdminSessionSnapshot/);
  assert.match(accounts, /listAdminAccountsFromRelation/);
  assert.match(accounts, /listAdminAccountsLegacy/);
  assert.match(accounts, /unstable_cache/);
  assert.match(accounts, /revalidateTag\(getAdminAccountCacheTag\(memberId\), "max"\)/);
  assert.match(accounts, /revalidate: ADMIN_ACCOUNT_CACHE_REVALIDATE_SECONDS/);
  assert.match(auth, /getAdminAccountById\(payload\.adminId\)/);
  assert.match(migration, /create or replace function public\.get_admin_session_snapshot\(p_member_id uuid\)/);
  assert.match(migration, /'permission_version'/);
  assert.match(migration, /'is_active'/);
  assert.match(migration, /grant execute on function public\.get_admin_session_snapshot\(uuid\) to service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.get_admin_session_snapshot\(uuid\) to (public|anon|authenticated)/);
});
