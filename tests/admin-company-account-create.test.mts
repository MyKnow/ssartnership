import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type SharedParsersModule =
  typeof import("../src/app/admin/(protected)/_actions/shared-parsers.ts");

const sharedParsersPromise = import(
  new URL(
    "../src/app/admin/(protected)/_actions/shared-parsers.ts",
    import.meta.url,
  ).href,
) as Promise<SharedParsersModule>;

const root = new URL("..", import.meta.url);

test("partner account create parser normalizes required fields", async () => {
  const { parsePartnerAccountCreatePayload } = await sharedParsersPromise;
  const formData = new FormData();
  formData.set("loginId", "Partner@Example.com");
  formData.set("displayName", "박지수");
  formData.set("companyId", "company-123");
  formData.set("isActive", "true");

  const payload = parsePartnerAccountCreatePayload(formData);

  assert.equal(payload.loginId, "partner@example.com");
  assert.equal(payload.displayName, "박지수");
  assert.equal(payload.companyId, "company-123");
  assert.equal(payload.isActive, true);
});

test("partner account create parser rejects missing company", async () => {
  const { parsePartnerAccountCreatePayload } = await sharedParsersPromise;
  const formData = new FormData();
  formData.set("loginId", "partner@example.com");
  formData.set("displayName", "박지수");

  assert.throws(() => parsePartnerAccountCreatePayload(formData), {
    message: "partner_account_company_missing",
  });
});

test("partner account create rollback failure is surfaced as an uncertain cleanup state", async () => {
  const [actionSource, errorSource] = await Promise.all([
    readFile(
      new URL(
        "src/app/admin/(protected)/_actions/account-actions.account.ts",
        root,
      ),
      "utf8",
    ),
    readFile(new URL("src/lib/admin-action-errors.ts", root), "utf8"),
  ]);

  assert.match(
    actionSource,
    /const cleanup = async \(\) => \{[\s\S]*?const \{ error \} = await supabase[\s\S]*?\.from\("partner_accounts"\)[\s\S]*?\.delete\(\)[\s\S]*?if \(error\) \{\s*throw new Error\(error\.message\);\s*\}/,
  );
  assert.match(actionSource, /partner_account_create_uncertain/);
  assert.match(
    actionSource,
    /console\.error\("\[admin\] partner account cleanup failed", cleanupError\);/,
  );
  assert.match(
    errorSource,
    /partner_account_create_uncertain:\s*"파트너사 계정 생성 중 정리가 끝나지 않았을 수 있습니다\./,
  );
});
