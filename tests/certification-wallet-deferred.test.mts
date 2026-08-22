import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("보류된 Apple Wallet은 내 인증 화면과 화면 인벤토리에서 노출하지 않는다", async () => {
  const [page, inventory] = await Promise.all([
    read("src/app/(site)/certification/page.tsx"),
    read("src/lib/mock/scenarios/route-inventory.ts"),
  ]);

  assert.doesNotMatch(page, /AppleWalletPassSection/);
  assert.doesNotMatch(page, /getAppleWalletMemberState/);
  assert.doesNotMatch(page, /resolveAppleWalletCardState/);
  assert.match(
    inventory,
    /routePath: "\/certification",[\s\S]*viewComponent: "CertificationView"/,
  );
});
