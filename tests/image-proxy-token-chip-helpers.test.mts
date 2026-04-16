import assert from "node:assert/strict";
import test from "node:test";

type ImageProxyIpModule = typeof import("../src/lib/image-proxy/ip.ts");
type TokenChipHelpersModule =
  typeof import("../src/components/admin/token-chip-field/helpers.ts");

const imageProxyIpPromise = import(
  new URL("../src/lib/image-proxy/ip.ts", import.meta.url).href,
) as Promise<ImageProxyIpModule>;

const tokenChipHelpersPromise = import(
  new URL("../src/components/admin/token-chip-field/helpers.ts", import.meta.url).href,
) as Promise<TokenChipHelpersModule>;

test("image proxy blocks private IP ranges and accepts public hosts", async () => {
  const { isPublicIpAddress } = await imageProxyIpPromise;

  assert.equal(isPublicIpAddress("127.0.0.1"), false);
  assert.equal(isPublicIpAddress("10.0.0.1"), false);
  assert.equal(isPublicIpAddress("8.8.8.8"), true);
});

test("token chip helpers dedupe and move items deterministically", async () => {
  const { dedupeTokenValues, moveTokenArrayItem, remapEditingIndexAfterMove } =
    await tokenChipHelpersPromise;

  assert.deepStrictEqual(dedupeTokenValues(["혜택", "혜택", " 문의 "]), [
    "혜택",
    "문의",
  ]);
  assert.deepStrictEqual(moveTokenArrayItem(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  assert.equal(remapEditingIndexAfterMove(1, 0, 2), 0);
});
