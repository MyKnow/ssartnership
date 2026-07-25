import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("제휴 등록 신청은 서버 범위 페이지 조회와 안전한 URL 페이지네이션을 사용한다", async () => {
  const [pageSource, viewSource, migrationSource, schemaSource] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/(protected)/partner-registrations/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminPartnerRegistrationsView.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260726041218_add_admin_partner_registration_queue_page.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /parseAdminReviewQueuePagination/);
  assert.match(pageSource, /listAdminPartnerRegistrationRequestPage/);
  assert.match(pageSource, /redirect\(/);
  assert.doesNotMatch(pageSource, /\.limit\(100\)/);
  assert.doesNotMatch(pageSource, /throw new Error/);
  assert.match(viewSource, /pagination/);
  assert.match(viewSource, /pageSize/);
  assert.match(viewSource, /등록 신청을 불러오지 못했습니다/);
  assert.match(migrationSource, /get_admin_partner_registration_request_page/);
  assert.match(migrationSource, /input_managed_campus_slugs text\[\] default null/);
  assert.match(migrationSource, /count\(\*\) over\(\)/);
  assert.match(migrationSource, /security invoker/);
  assert.match(migrationSource, /grant execute on function public\.get_admin_partner_registration_request_page/);
  assert.match(schemaSource, /get_admin_partner_registration_request_page/);
  assert.match(
    schemaSource,
    /partner_registration_requests_status_created_id_idx/,
  );
});
