import assert from "node:assert/strict";
import test from "node:test";
import { MockWalletPassRepository } from "../src/lib/repositories/mock/wallet-pass-repository.mock.ts";
import { SupabaseWalletPassRepository } from "../src/lib/repositories/supabase/wallet-pass-repository.supabase.ts";
import {
  createWalletPassRepository,
  WalletPassRepositoryUnavailableError,
} from "../src/lib/repositories/wallet-pass.ts";

test("explicit mock data source keeps the process-local wallet repository", () => {
  const repository = createWalletPassRepository({
    NEXT_PUBLIC_DATA_SOURCE: "mock",
  });

  assert.ok(repository instanceof MockWalletPassRepository);
});

test("complete Supabase admin configuration selects the durable wallet repository", () => {
  const repository = createWalletPassRepository({
    NEXT_PUBLIC_DATA_SOURCE: "supabase",
    SUPABASE_URL: "https://project.example.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  });

  assert.ok(repository instanceof SupabaseWalletPassRepository);
});

test("missing Supabase admin configuration fails closed only when wallet storage is used", async () => {
  for (const environment of [
    {
      NEXT_PUBLIC_DATA_SOURCE: "supabase",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    },
    {
      NEXT_PUBLIC_DATA_SOURCE: "supabase",
      SUPABASE_URL: "https://project.example.invalid",
    },
    {
      NEXT_PUBLIC_DATA_SOURCE: "supabase",
      SUPABASE_URL: " ",
      SUPABASE_SERVICE_ROLE_KEY: " ",
    },
    {},
  ]) {
    const repository = createWalletPassRepository(environment);

    for (const operation of [
      () =>
        repository.getMemberWalletPass({
          memberId: "member-1",
          platform: "apple",
        }),
      () =>
        repository.issueMemberWalletPass({
          memberId: "member-1",
          platform: "apple",
          consentVersion: 1,
          consentedAt: "2026-08-12T00:00:00.000Z",
          snapshotHash: "snapshot-hash",
          snapshot: {},
          idempotencyKey: "idempotency-key",
          requestFingerprint: "request-fingerprint",
        }),
    ]) {
      await assert.rejects(operation, (error: unknown) => {
        assert.ok(error instanceof WalletPassRepositoryUnavailableError);
        assert.equal(error.code, "wallet_pass_repository_unavailable");
        assert.equal(
          error.message,
          "Apple Wallet 저장소를 사용할 수 없습니다.",
        );
        return true;
      });
    }
  }
});
