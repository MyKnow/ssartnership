import assert from "node:assert/strict";
import test from "node:test";
import { isMissingSupabasePoolerTenantErrorMessage } from "../scripts/supabase-db-health-lib.mjs";

test("preview db health detects missing Supabase pooler tenant errors", () => {
  assert.equal(
    isMissingSupabasePoolerTenantErrorMessage(
      'psql: error: connection to server at "aws-1-ap-northeast-2.pooler.supabase.com", port 5432 failed: FATAL:  (ENOTFOUND) tenant/user postgres.uuxzzanpxzvhauzxufuk not found',
    ),
    true,
  );
  assert.equal(
    isMissingSupabasePoolerTenantErrorMessage(
      "psql: error: FATAL: password authentication failed for user postgres",
    ),
    false,
  );
  assert.equal(
    isMissingSupabasePoolerTenantErrorMessage(
      "psql: error: connection timeout expired",
    ),
    false,
  );
});
