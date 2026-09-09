import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MAX_APPLE_WALLET_PUSH_TOKENS_PER_BATCH,
  normalizeAppleWalletDeviceRegistrationReadLimit,
} from "../src/lib/wallet/apple/limits.ts";

test("Apple Wallet 기기 조회량은 APNs 전송 상한과 같은 값으로 제한한다", () => {
  assert.equal(MAX_APPLE_WALLET_PUSH_TOKENS_PER_BATCH, 1_000);
  assert.equal(normalizeAppleWalletDeviceRegistrationReadLimit(10), 10);
  assert.equal(normalizeAppleWalletDeviceRegistrationReadLimit(0), 1);
  assert.equal(normalizeAppleWalletDeviceRegistrationReadLimit(10_000), 1_000);
  assert.equal(
    normalizeAppleWalletDeviceRegistrationReadLimit(Number.POSITIVE_INFINITY),
    1_000,
  );
});

test("기기 알림 조회와 무효 토큰 정리는 각각 DB limit과 제한된 동시성을 사용한다", async () => {
  const [repositorySource, serviceSource] = await Promise.all([
    readFile(
      new URL(
        "../src/lib/repositories/supabase/wallet-pass-repository.supabase.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/wallet/wallet-pass-service.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    repositorySource,
    /\.limit\(normalizeAppleWalletDeviceRegistrationReadLimit\(input\.limit\)\)/u,
  );
  assert.match(
    serviceSource,
    /forEachWithConcurrency\(\s*registrations,\s*APPLE_WALLET_DEVICE_CLEANUP_CONCURRENCY,/u,
  );
  assert.doesNotMatch(
    serviceSource,
    /Promise\.all\(\s*registrations\.map/u,
  );
});
