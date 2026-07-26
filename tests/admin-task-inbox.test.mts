import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ADMIN_PERMISSION_TEMPLATES } from "../src/lib/admin-permissions.ts";

const taskInboxModulePromise = import(
  new URL("../src/lib/admin-task-inbox.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/admin-task-inbox.ts")>;

test("작업함은 대기 건수가 있는 업무를 먼저 보여주고 확인 불가 항목은 뒤로 보낸다", async () => {
  const { prioritizeAdminTaskItems } = await taskInboxModulePromise;
  const tasks = [
    { href: "/admin/notifications", label: "알림" },
    { href: "/admin/partner-requests", label: "변경 요청" },
    { href: "/admin/members", label: "회원" },
    { href: "/admin/profile-photos", label: "프로필 사진" },
  ];

  assert.deepEqual(
    prioritizeAdminTaskItems(tasks, {
      "/admin/notifications": 0,
      "/admin/partner-requests": 4,
      "/admin/profile-photos": null,
    }).map((task) => task.href),
    [
      "/admin/partner-requests",
      "/admin/notifications",
      "/admin/members",
      "/admin/profile-photos",
    ],
  );
});

test("작업함의 DB 실패는 안전한 미확인 상태로 표현한다", async () => {
  const { toSafeAdminTaskQueueCount } = await taskInboxModulePromise;

  assert.equal(toSafeAdminTaskQueueCount({ count: 3, error: null }), 3);
  assert.equal(toSafeAdminTaskQueueCount({ count: null, error: null }), 0);
  assert.equal(
    toSafeAdminTaskQueueCount({ count: 11, error: { message: "internal" } }),
    null,
  );
});

test("작업함은 지역 제휴 관리자의 범위를 보존한 단일 집계 조회를 사용한다", async () => {
  const { fetchAdminTaskInboxQueueCounts } = await taskInboxModulePromise;
  const regionalPermissions = ADMIN_PERMISSION_TEMPLATES.find(
    (template) => template.key === "regional_partner_manager",
  )?.permissions;
  assert.ok(regionalPermissions);

  const calls: Array<{ name: string; input: unknown }> = [];
  const queueCounts = await fetchAdminTaskInboxQueueCounts(
    {
      rpc: async (name: string, input: unknown) => {
        calls.push({ name, input });
        return {
          data: [
            {
              registration_pending_count: 2,
              change_request_pending_count: 3,
              graduate_verification_pending_count: null,
              signup_request_pending_count: null,
              profile_photo_pending_count: null,
              unread_notification_count: null,
            },
          ],
          error: null,
        };
      },
    } as never,
    {
      adminId: "admin-1",
      account: {
        permissionId: "regional_partner_manager",
        managedCampusSlugs: ["seoul"],
        permissions: regionalPermissions,
      },
    },
  );

  assert.deepEqual(calls, [
    {
      name: "get_admin_task_inbox_counts",
      input: {
        input_admin_id: "admin-1",
        input_managed_campus_slugs: ["seoul"],
        input_include_brand_queues: true,
        input_include_graduate_verifications: false,
        input_include_signup_requests: false,
        input_include_profile_photos: false,
        input_include_notifications: false,
      },
    },
  ]);
  assert.equal(queueCounts["/admin/partner-registrations"], 2);
  assert.equal(queueCounts["/admin/partner-requests"], 3);
  assert.equal(queueCounts["/admin/graduate-verifications"], undefined);
});

test("작업함 집계 RPC는 권한 없는 큐를 계산하지 않고 service role로만 실행된다", async () => {
  const migration = await readFile(
    new URL(
      "../supabase/migrations/20260726074927_add_admin_task_inbox_counts.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(migration, /input_include_brand_queues boolean default false/);
  assert.match(
    migration,
    /input_include_graduate_verifications boolean default false/,
  );
  assert.match(migration, /case when input_include_brand_queues then/);
  assert.match(
    migration,
    /company\.managed_campus_slugs && scope\.managed_campus_slugs/,
  );
  assert.match(migration, /security invoker/);
  assert.match(
    migration,
    /grant execute on function public\.get_admin_task_inbox_counts[\s\S]+to service_role/,
  );
});

test("작업함은 count 조회를 기다리지 않고 업무 링크를 먼저 렌더링한다", async () => {
  const [pageSource, viewSource] = await Promise.all([
    readFile(
      new URL("../src/app/admin/(protected)/tasks/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/admin/AdminTaskInboxView.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(pageSource, /const queueCounts =\s+session && tasks\.length > 0/);
  assert.doesNotMatch(pageSource, /await getAdminTaskQueueCounts/);
  assert.match(pageSource, /AdminTaskInboxStreamingView/);
  assert.match(viewSource, /<Suspense fallback={<AdminTaskInboxLoading/);
  assert.match(viewSource, /prioritizeAdminTaskItems\(tasks, resolvedCounts\)/);
  assert.match(viewSource, /상태 확인 필요/);
});

test("홈의 다음 작업은 실제 대기 건이 있는 권한 내 작업만 선택한다", async () => {
  const { getNextAdminTaskItem } = await taskInboxModulePromise;
  const tasks = [
    {
      href: "/admin/partner-registrations?status=pending",
      label: "신규 제휴 접수",
    },
    { href: "/admin/partner-requests", label: "제휴처 변경 요청" },
    { href: "/admin/notifications", label: "읽지 않은 알림" },
  ];

  assert.equal(
    getNextAdminTaskItem(tasks, {
      "/admin/partner-registrations?status=pending": 2,
      "/admin/partner-requests": 4,
      "/admin/notifications": 0,
    })?.href,
    "/admin/partner-requests",
  );
  assert.equal(
    getNextAdminTaskItem(tasks, {
      "/admin/partner-registrations?status=pending": 0,
      "/admin/partner-requests": 0,
      "/admin/notifications": 0,
    }),
    null,
  );

  assert.equal(
    getNextAdminTaskItem(
      [
        { href: "/admin/partner-registrations?status=pending", priority: 0 },
        { href: "/admin/notifications", priority: 3 },
      ],
      {
        "/admin/partner-registrations?status=pending": 1,
        "/admin/notifications": 8,
      },
    )?.href,
    "/admin/partner-registrations?status=pending",
  );
});

test("관리 홈은 모든 권한 내 검토 큐를 다음 작업 후보에 포함한다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/AdminDashboardView.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /href: "\/admin\/graduate-verifications"/);
  assert.match(source, /count: queueCounts\.graduateVerificationPendingCount/);
  assert.match(source, /href: "\/admin\/member-signup-requests"/);
  assert.match(source, /count: queueCounts\.signupRequestPendingCount/);
  assert.match(source, /href: "\/admin\/profile-photos"/);
  assert.match(source, /count: queueCounts\.profilePhotoPendingCount/);
});

test("관리 홈은 다음 작업을 우선 표시하고, 활동 지표 조회가 첫 화면을 막지 않는다", async () => {
  const [dashboardSource, pageSource] = await Promise.all([
    readFile(
      new URL(
        "../src/components/admin/AdminDashboardView.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/app/admin/(protected)/page.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(dashboardSource, /getNextAdminTaskItem/);
  assert.match(dashboardSource, /다음으로 처리/);
  assert.match(pageSource, /AdminDashboardPlatformActivitySection/);
  assert.doesNotMatch(
    pageSource,
    /fetchAdminPlatformActivityMetrics\(supabase\)/,
  );
  assert.doesNotMatch(pageSource, /collectPagedRows/);
});
