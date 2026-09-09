import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rootUrl = new URL("../", import.meta.url);

async function readProjectFile(path: string) {
  return readFile(new URL(path, rootUrl), "utf8");
}

test("광고 쿠폰 RPC는 최신 signature로 service_role 전용 execute 권한을 유지한다", async () => {
  const migration = await readProjectFile(
    "supabase/migrations/20260831141920_grant_ad_coupon_rpc_service_role.sql",
  );

  for (const signature of [
    "issue_ad_coupon\\(uuid, uuid, text\\)",
    "redeem_ad_coupon_issue\\(uuid, uuid, text, jsonb, text\\)",
  ]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from public;`));
    assert.match(migration, new RegExp(`revoke all on function public\\.${signature} from anon;`));
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${signature} from authenticated;`),
    );
    assert.match(
      migration,
      new RegExp(`grant execute on function public\\.${signature} to service_role;`),
    );
  }
});

test("schema snapshot syncs the latest ad coupon RPC definitions and permission contract", async () => {
  const schema = await readProjectFile("supabase/schema.sql");

  assert.match(schema, /create or replace function public\.issue_ad_coupon\(/);
  assert.match(schema, /member_redeemed_count >= coupon_row\.per_member_limit/);
  assert.match(schema, /total_redeemed_count >= coupon_row\.usage_limit/);
  assert.match(schema, /gen_random_uuid\(\)::text/);

  assert.match(
    schema,
    /create or replace function public\.redeem_ad_coupon_issue\([\s\S]*p_verified_onsite_password_hash text default null[\s\S]*member_redeemed_count integer[\s\S]*total_redeemed_count integer/,
  );
  assert.match(schema, /ad_coupon_onsite_password_invalid/);

  for (const signature of [
    "issue_ad_coupon\\(uuid, uuid, text\\)",
    "redeem_ad_coupon_issue\\(uuid, uuid, text, jsonb, text\\)",
  ]) {
    assert.match(schema, new RegExp(`revoke all on function public\\.${signature} from public;`));
    assert.match(schema, new RegExp(`revoke all on function public\\.${signature} from anon;`));
    assert.match(
      schema,
      new RegExp(`revoke all on function public\\.${signature} from authenticated;`),
    );
    assert.match(
      schema,
      new RegExp(`grant execute on function public\\.${signature} to service_role;`),
    );
  }
});
