import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("제휴 등록 신청은 조회·검토·생성 권한에 맞춰 CTA를 노출한다", async () => {
  const [page, view] = await Promise.all([
    read("src/app/admin/(protected)/partner-registrations/page.tsx"),
    read("src/components/admin/AdminPartnerRegistrationsView.tsx"),
  ]);

  assert.match(
    page,
    /canAdmin\(\s*adminSession\.account\.permissions,\s*"brands",\s*"update"/,
  );
  assert.match(
    page,
    /canAdmin\(\s*adminSession\.account\.permissions,\s*"brands",\s*"create"/,
  );
  assert.match(page, /canReview=\{canReview\}/);
  assert.match(page, /canCreate=\{canCreate\}/);
  assert.match(view, /canReview = true/);
  assert.match(view, /canCreate = true/);
  assert.match(view, /canCreate \?/);
  assert.match(view, /canReview \?/);
  assert.match(view, /조회 전용 권한/);
});
