import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("제휴 등록 신청은 서버 범위 페이지 조회와 안전한 URL 페이지네이션을 사용한다", async () => {
  const [pageSource, viewSource, actionSource, feedbackSource, migrationSource, schemaSource, followUpMigrationSource] = await Promise.all([
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
        "../src/app/admin/(protected)/partner-registrations/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/admin-review-queue.ts", import.meta.url),
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
    readFile(
      new URL(
        "../supabase/migrations/20260801234849_partner_registration_visibility_and_search.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /parseAdminReviewQueuePagination/);
  assert.match(pageSource, /listAdminPartnerRegistrationRequestPage/);
  assert.match(pageSource, /redirect\(/);
  assert.doesNotMatch(pageSource, /\.limit\(100\)/);
  assert.doesNotMatch(pageSource, /throw new Error/);
  assert.match(viewSource, /pagination/);
  assert.match(viewSource, /pageSize/);
  assert.match(viewSource, /등록 신청을 불러오지 못했습니다/);
  assert.match(viewSource, /신청 찾기/);
  assert.match(viewSource, /공개 상태/);
  assert.match(viewSource, /<details/);
  assert.match(actionSource, /\.eq\("status", previousStatus\)/);
  assert.match(actionSource, /request: \{ \.\.\.registrationRequest, visibility \}/);
  assert.match(actionSource, /\/admin\/partners\/\$\{convertedPartnerId\}/);
  assert.match(actionSource, /success: "already-updated"/);
  assert.match(feedbackSource, /partner_form_conversion_failed/);
  assert.match(migrationSource, /get_admin_partner_registration_request_page/);
  assert.match(migrationSource, /input_managed_campus_slugs text\[\] default null/);
  assert.match(migrationSource, /count\(\*\) over\(\)/);
  assert.match(migrationSource, /row_number\(\) over \(order by created_at desc, id desc\)/);
  assert.match(
    migrationSource,
    /where numbered_rows\.row_num > \(\(parameters\.page - 1\) \* parameters\.page_size\)/,
  );
  assert.doesNotMatch(migrationSource, /offset \(parameters\.page - 1\)/i);
  assert.match(migrationSource, /security invoker/);
  assert.match(migrationSource, /grant execute on function public\.get_admin_partner_registration_request_page/);
  assert.match(schemaSource, /get_admin_partner_registration_request_page/);
  assert.match(
    schemaSource,
    /partner_registration_requests_status_created_id_idx/,
  );
  assert.match(followUpMigrationSource, /partner_registration_requests_visibility_check/);
  assert.match(followUpMigrationSource, /input_search text default null/);
  assert.match(followUpMigrationSource, /input_visibility text default null/);
  assert.match(followUpMigrationSource, /input_sort text default 'recent'/);
});
