import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

type ResolveResult = { shortCircuit?: boolean; url: string };
type NextResolve = (specifier: string, context: unknown) => ResolveResult;

const { registerHooks } = nodeModule as unknown as {
  registerHooks(hooks: {
    resolve: (
      specifier: string,
      context: unknown,
      nextResolve: NextResolve,
    ) => ResolveResult;
  }): void;
};

type QueryOperation = "delete" | "insert" | "select" | "update" | "upsert";

type QueryCall = {
  table: string;
  operation: QueryOperation;
  payload?: unknown;
  filters: Array<{
    operator: "eq" | "in";
    column: string;
    value: unknown;
  }>;
};

type QueryResult = {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
};

type QueryHandler = (call: QueryCall) => QueryResult | Promise<QueryResult>;

const mockModules = new Map<string, string>([
  [
    "@/lib/supabase/server",
    `export function getSupabaseAdminClient() {
      return globalThis.__operationalNotificationTestSupabase;
    }`,
  ],
  [
    "@/lib/notification-templates/repository.server",
    `export async function resolveNotificationTemplate() {
      return { titleTemplate: "테스트 제목", bodyTemplate: "테스트 본문" };
    }`,
  ],
  [
    "@/lib/admin-accounts",
    `export async function listAdminAccounts() {
      const failure = globalThis.__operationalNotificationTestAdminAccountFailure;
      if (failure) {
        globalThis.__operationalNotificationTestAdminAccountFailure = null;
        throw failure;
      }
      return globalThis.__operationalNotificationTestAdminAccounts ?? [
        {
          id: "admin-1",
          isActive: true,
          permissions: { notifications: { read: true } },
        },
      ];
    }`,
  ],
  [
    "@/lib/partner-email",
    `export async function sendPartnerOperationalNotificationEmail() {
      return undefined;
    }`,
  ],
  [
    "@/lib/push/config",
    `export function isPushConfigured() {
      return globalThis.__operationalNotificationTestPushConfigured === true;
    }
    export function getPushEnv() {
      return { publicKey: "test", privateKey: "test", subject: "mailto:test@example.com" };
    }`,
  ],
  ["@/lib/partner-auth/portal", "export const isPartnerPortalMock = false;"],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const source = mockModules.get(specifier);
    if (source !== undefined) {
      return {
        shortCircuit: true,
        url: `data:text/javascript,${encodeURIComponent(source)}`,
      };
    }
    return nextResolve(specifier, context);
  },
});

class FakeQuery {
  private operation: QueryOperation = "select";
  private payload: unknown;
  private readonly filters: QueryCall["filters"] = [];
  private readonly table: string;
  private readonly handler: QueryHandler;

  constructor(table: string, handler: QueryHandler) {
    this.table = table;
    this.handler = handler;
  }

  insert(payload: unknown) {
    this.operation = "insert";
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  update(payload: unknown) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  upsert(payload: unknown) {
    this.operation = "upsert";
    this.payload = payload;
    return this;
  }

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ operator: "eq", column, value });
    return this;
  }

  in(column: string, value: unknown) {
    this.filters.push({ operator: "in", column, value });
    return this;
  }

  order() {
    return this;
  }

  maybeSingle() {
    return this.execute();
  }

  single() {
    return this.execute();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private execute() {
    return Promise.resolve(
      this.handler({
        table: this.table,
        operation: this.operation,
        payload: this.payload,
        filters: [...this.filters],
      }),
    );
  }
}

function installSupabase(handler: QueryHandler) {
  const supabase = {
    from(table: string) {
      return new FakeQuery(table, handler);
    },
  };
  (
    globalThis as Record<string, unknown>
  ).__operationalNotificationTestSupabase = supabase;
  return supabase;
}

function setPushConfigured(configured: boolean) {
  (
    globalThis as Record<string, unknown>
  ).__operationalNotificationTestPushConfigured = configured;
}

function setAdminAccounts(accounts: unknown[]) {
  (
    globalThis as Record<string, unknown>
  ).__operationalNotificationTestAdminAccounts = accounts;
}

function failNextAdminAccountLookup(error: Error) {
  (
    globalThis as Record<string, unknown>
  ).__operationalNotificationTestAdminAccountFailure = error;
}

type OperationalNotificationsModule =
  typeof import("../src/lib/operational-notifications.ts");

const operationalNotificationsModulePromise = import(
  new URL("../src/lib/operational-notifications.ts", import.meta.url).href
) as Promise<OperationalNotificationsModule>;

function notificationInsertResult(
  call: QueryCall,
  audience: "admin" | "partner",
) {
  if (
    call.table === `${audience}_notifications` &&
    call.operation === "insert"
  ) {
    return { data: { id: `${audience}-notification-1` }, error: null };
  }
  return null;
}

function assertBaseNotificationDeleted(
  calls: QueryCall[],
  audience: "admin" | "partner",
) {
  assert.ok(
    calls.some(
      (call) =>
        call.table === `${audience}_notifications` &&
        call.operation === "delete" &&
        call.filters.some(
          (filter) =>
            filter.operator === "eq" &&
            filter.column === "id" &&
            filter.value === `${audience}-notification-1`,
        ),
    ),
    `${audience} 기본 알림 삭제가 실행되어야 합니다.`,
  );
}

test("관리자 계정 조회가 실패하면 먼저 만든 기본 알림을 삭제한다", async () => {
  const calls: QueryCall[] = [];
  installSupabase((call) => {
    calls.push(call);
    const inserted = notificationInsertResult(call, "admin");
    if (inserted) return inserted;
    return { data: null, error: null };
  });
  failNextAdminAccountLookup(new Error("account lookup failed"));
  setPushConfigured(false);

  const { createAdminOperationalNotification } =
    await operationalNotificationsModulePromise;
  await assert.rejects(
    createAdminOperationalNotification({
      type: "security_alert",
      title: "보안 알림",
      body: "계정 조회 실패",
      requestedChannels: ["portal"],
    }),
    /account lookup failed/,
  );

  assertBaseNotificationDeleted(calls, "admin");
});

test("파트너 계정 조회가 실패하면 먼저 만든 기본 알림을 삭제한다", async () => {
  const calls: QueryCall[] = [];
  installSupabase((call) => {
    calls.push(call);
    const inserted = notificationInsertResult(call, "partner");
    if (inserted) return inserted;
    if (call.table === "partner_accounts") {
      return { data: null, error: { message: "account lookup failed" } };
    }
    return { data: null, error: null };
  });
  setPushConfigured(false);

  const { createPartnerOperationalNotification } =
    await operationalNotificationsModulePromise;
  await assert.rejects(
    createPartnerOperationalNotification({
      type: "plan_changed",
      companyId: "company-1",
      title: "플랜 변경",
      body: "계정 조회 실패",
      requestedChannels: ["portal"],
    }),
    /account lookup failed/,
  );

  assertBaseNotificationDeleted(calls, "partner");
});

for (const audience of ["admin", "partner"] as const) {
  test(`${audience} 수신자 저장이 실패하면 먼저 만든 기본 알림을 삭제한다`, async () => {
    const calls: QueryCall[] = [];
    installSupabase((call) => {
      calls.push(call);
      const inserted = notificationInsertResult(call, audience);
      if (inserted) return inserted;
      if (call.table === "admin_notification_preferences") {
        return { data: [], error: null };
      }
      if (call.table === "partner_accounts") {
        return {
          data: [
            {
              id: "account-1",
              display_name: "담당자",
              email: "partner@example.com",
              login_id: "partner",
              preferences: null,
            },
          ],
          error: null,
        };
      }
      if (call.table === `${audience}_notification_recipients`) {
        return { data: null, error: { message: "recipient insert failed" } };
      }
      return { data: null, error: null };
    });
    setPushConfigured(false);

    const {
      createAdminOperationalNotification,
      createPartnerOperationalNotification,
    } = await operationalNotificationsModulePromise;
    const create =
      audience === "admin"
        ? createAdminOperationalNotification({
            type: "security_alert",
            title: "관리자 알림",
            body: "수신자 저장 실패",
            requestedChannels: ["portal"],
          })
        : createPartnerOperationalNotification({
            type: "plan_changed",
            companyId: "company-1",
            title: "파트너 알림",
            body: "수신자 저장 실패",
            requestedChannels: ["portal"],
          });

    await assert.rejects(create, /recipient insert failed/);
    assertBaseNotificationDeleted(calls, audience);
  });
}

for (const audience of ["admin", "partner"] as const) {
  test(`${audience} 기본 알림 삭제까지 실패하면 저장 상태 불확실 오류를 던진다`, async () => {
    installSupabase((call) => {
      const inserted = notificationInsertResult(call, audience);
      if (inserted) return inserted;
      if (
        call.table === `${audience}_notifications` &&
        call.operation === "delete"
      ) {
        return { data: null, error: { message: "rollback delete failed" } };
      }
      if (call.table === "partner_accounts") {
        return { data: null, error: { message: "account lookup failed" } };
      }
      return { data: null, error: null };
    });
    setPushConfigured(false);
    if (audience === "admin") {
      failNextAdminAccountLookup(new Error("admin account lookup failed"));
    }

    const {
      createAdminOperationalNotification,
      createPartnerOperationalNotification,
      OperationalNotificationPersistenceUncertainError,
    } = await operationalNotificationsModulePromise;
    const create =
      audience === "admin"
        ? createAdminOperationalNotification({
            type: "security_alert",
            title: "관리자 알림",
            body: "롤백 실패",
            requestedChannels: ["portal"],
          })
        : createPartnerOperationalNotification({
            type: "plan_changed",
            companyId: "company-1",
            title: "파트너 알림",
            body: "롤백 실패",
            requestedChannels: ["portal"],
          });

    await assert.rejects(create, (error: unknown) => {
      assert.ok(
        error instanceof OperationalNotificationPersistenceUncertainError,
      );
      assert.ok(error.cause instanceof AggregateError);
      assert.deepEqual(
        error.cause.errors.map((cause) =>
          cause instanceof Error ? cause.message : String(cause),
        ),
        [
          audience === "admin"
            ? "admin account lookup failed"
            : "account lookup failed",
          "rollback delete failed",
        ],
      );
      return true;
    });
  });
}

for (const audience of ["admin", "partner"] as const) {
  test(`${audience} 푸시 준비 실패는 배송 실패로 기록하고 생성 결과는 반환한다`, async (t) => {
    t.mock.method(console, "error", () => undefined);
    const calls: QueryCall[] = [];
    installSupabase((call) => {
      calls.push(call);
      const inserted = notificationInsertResult(call, audience);
      if (inserted) return inserted;
      if (call.table === "admin_notification_preferences") {
        return { data: [], error: null };
      }
      if (call.table === "partner_accounts") {
        return {
          data: [
            {
              id: "account-1",
              display_name: "담당자",
              email: "partner@example.com",
              login_id: "partner",
              preferences: null,
            },
          ],
          error: null,
        };
      }
      if (call.table === `${audience}_push_subscriptions`) {
        return { data: null, error: { message: "push setup failed" } };
      }
      return { data: null, error: null };
    });
    setPushConfigured(true);

    const {
      createAdminOperationalNotification,
      createPartnerOperationalNotification,
    } = await operationalNotificationsModulePromise;
    const result =
      audience === "admin"
        ? await createAdminOperationalNotification({
            type: "security_alert",
            title: "관리자 푸시",
            body: "푸시 준비 실패",
            requestedChannels: ["push"],
          })
        : await createPartnerOperationalNotification({
            type: "plan_changed",
            companyId: "company-1",
            title: "파트너 푸시",
            body: "푸시 준비 실패",
            requestedChannels: ["push"],
          });

    assert.deepEqual(result, {
      notificationId: `${audience}-notification-1`,
      recipientCount: 0,
    });
    assert.ok(
      calls.some(
        (call) =>
          call.table === `${audience}_notification_deliveries` &&
          call.operation === "insert" &&
          typeof call.payload === "object" &&
          call.payload !== null &&
          "status" in call.payload &&
          call.payload.status === "failed" &&
          "error_message" in call.payload &&
          call.payload.error_message === "push setup failed",
      ),
    );
  });
}

test("관리자 알림은 활성 상태이며 알림 조회 권한이 있는 계정에만 전달한다", async () => {
  const calls: QueryCall[] = [];
  setAdminAccounts([
    {
      id: "admin-allowed",
      isActive: true,
      permissions: { notifications: { read: true } },
    },
    {
      id: "admin-denied",
      isActive: true,
      permissions: { notifications: { read: false } },
    },
    {
      id: "admin-inactive",
      isActive: false,
      permissions: { notifications: { read: true } },
    },
  ]);
  installSupabase((call) => {
    calls.push(call);
    const inserted = notificationInsertResult(call, "admin");
    if (inserted) return inserted;
    if (call.table === "admin_notification_preferences") {
      return { data: [], error: null };
    }
    return { data: null, error: null };
  });
  setPushConfigured(false);

  try {
    const { createAdminOperationalNotification } =
      await operationalNotificationsModulePromise;
    const result = await createAdminOperationalNotification({
      type: "partner_registration_request",
      title: "제휴 등록 요청",
      body: "권한이 있는 관리자에게만 전달",
      requestedChannels: ["portal"],
    });

    assert.equal(result.recipientCount, 1);
    const recipientInsert = calls.find(
      (call) =>
        call.table === "admin_notification_recipients" &&
        call.operation === "insert",
    );
    assert.deepEqual(recipientInsert?.payload, [
      {
        notification_id: "admin-notification-1",
        admin_id: "admin-allowed",
      },
    ]);
  } finally {
    setAdminAccounts([
      {
        id: "admin-1",
        isActive: true,
        permissions: { notifications: { read: true } },
      },
    ]);
  }
});

test("알림 생성 실패 후 dedupe 해제도 실패하면 두 원인을 AggregateError로 보존한다", async () => {
  const { createDedupedOperationalNotification } =
    await operationalNotificationsModulePromise;
  const creationError = new Error("notification create failed");
  const releaseError = new Error("dedupe release failed");

  await assert.rejects(
    createDedupedOperationalNotification({
      dedupe: {
        dedupeKey: "atomicity-release-failure",
        audience: "admin",
        notificationType: "security_alert",
        targetId: "security-event-1",
      },
      claim: async () => true,
      create: async () => {
        throw creationError;
      },
      release: async () => {
        throw releaseError;
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /중복 방지 예약을 해제하지 못했습니다/);
      assert.ok(error.cause instanceof AggregateError);
      assert.deepEqual(error.cause.errors, [creationError, releaseError]);
      return true;
    },
  );
});

for (const audience of ["admin", "partner"] as const) {
  test(`${audience} 환경 설정 수정은 기존 채널 설정을 유지하고 소유자 키에 저장한다`, async () => {
    const calls: QueryCall[] = [];
    installSupabase((call) => {
      calls.push(call);
      return {
        data: call.operation === "select"
          ? { enabled: true, portal_enabled: false, push_enabled: true, email_enabled: false }
          : null,
        error: null,
      };
    });
    const api = await operationalNotificationsModulePromise;
    const next = audience === "admin"
      ? await api.upsertAdminOperationalNotificationPreferences("owner-1", { pushEnabled: false })
      : await api.upsertPartnerOperationalNotificationPreferences("owner-1", { pushEnabled: false });
    assert.equal(next.enabled, true);
    assert.equal(next.portalEnabled, false);
    assert.equal(next.pushEnabled, false);
    const save = calls.find((call) => call.operation === "upsert");
    assert.equal(save?.table, `${audience}_notification_preferences`);
    assert.equal((save?.payload as Record<string, unknown>)[audience === "admin" ? "admin_id" : "account_id"], "owner-1");
    assert.equal((save?.payload as Record<string, unknown>).portal_enabled, false);
    assert.equal((save?.payload as Record<string, unknown>).push_enabled, false);
  });

  test(`${audience} 구독 장치 조회·개수·해제는 해당 계정 소유권을 유지한다`, async () => {
    const calls: QueryCall[] = [];
    installSupabase((call) => {
      calls.push(call);
      return {
        data: call.operation === "select" ? [{
          id: "device-1", endpoint: "https://push.example/device-1", user_agent: "Firefox",
          created_at: "2026-01-01", updated_at: "2026-02-01", last_success_at: null,
        }] : null,
        count: 1,
        error: null,
      };
    });
    const api = await operationalNotificationsModulePromise;
    const input = { ownerType: audience, ownerId: "owner-1" };
    const devices = await api.listOperationalPushSubscriptionDevices({
      ...input, currentEndpoint: "https://push.example/device-1",
    });
    assert.equal(devices[0].id, "device-1");
    assert.equal(devices[0].isCurrent, true);
    assert.equal(devices[0].lastSuccessAt, null);
    assert.equal(await api.countOperationalPushSubscriptionDevices(input), 1);
    await api.deactivateOperationalPushSubscription({ ...input, subscriptionId: "device-1" });
    await api.deactivateOperationalPushSubscription({ ...input, endpoint: "https://push.example/device-1" });
    await api.deactivateOperationalPushSubscription({ ...input, all: true, subscriptionId: "ignored" });
    for (const call of calls) {
      assert.equal(call.table, `${audience}_push_subscriptions`);
      assert.ok(call.filters.some((filter) => filter.column === (audience === "admin" ? "admin_id" : "account_id") && filter.value === "owner-1"));
    }
    const updates = calls.filter((call) => call.operation === "update");
    assert.deepEqual(updates.map((call) => call.filters.slice(1)), [
      [{ operator: "eq", column: "id", value: "device-1" }],
      [{ operator: "eq", column: "endpoint", value: "https://push.example/device-1" }],
      [],
    ]);
    assert.ok(updates.every((call) => (call.payload as Record<string, unknown>).is_active === false));
  });

  test(`${audience} 푸시 미설정은 전송 조회 없이 skipped를 기록하고 알림을 유지한다`, async () => {
    const calls: QueryCall[] = [];
    installSupabase((call) => {
      calls.push(call);
      const inserted = notificationInsertResult(call, audience);
      if (inserted) return inserted;
      if (call.table === "admin_notification_preferences") return { data: [], error: null };
      if (call.table === "partner_accounts") return { data: [{ id: "account-1", preferences: null }], error: null };
      return { data: null, error: null };
    });
    setPushConfigured(false);
    const api = await operationalNotificationsModulePromise;
    const result = audience === "admin"
      ? await api.createAdminOperationalNotification({ type: "security_alert", title: "제목", body: "본문", requestedChannels: ["push"] })
      : await api.createPartnerOperationalNotification({ type: "plan_changed", companyId: "company-1", title: "제목", body: "본문", requestedChannels: ["push"] });
    assert.equal(result.recipientCount, 0);
    assert.equal(calls.some((call) => call.table === `${audience}_push_subscriptions`), false);
    assert.equal(calls.some((call) => call.operation === "delete"), false);
    const delivery = calls.find((call) => call.table === `${audience}_notification_deliveries`);
    assert.equal((delivery?.payload as Record<string, unknown>).status, "skipped");
    assert.equal((delivery?.payload as Record<string, unknown>).error_message, "Web Push 환경 변수가 설정되지 않았습니다.");
  });
}

for (const accountIds of [undefined, ["account-1"]]) {
  test(`파트너 수신자 조회는 ${accountIds ? "명시 계정" : "활성 회사 연결"} 범위를 유지한다`, async () => {
    const calls: QueryCall[] = [];
    installSupabase((call) => {
      calls.push(call);
      return notificationInsertResult(call, "partner") ?? { data: [], error: null };
    });
    const api = await operationalNotificationsModulePromise;
    await api.createPartnerOperationalNotification({
      type: "plan_changed", companyId: "company-1", accountIds,
      title: "제목", body: "본문", requestedChannels: ["portal"],
    });
    const query = calls.find((call) => call.table === "partner_accounts");
    assert.deepEqual(query?.filters, [
      { operator: "eq", column: "is_active", value: true },
      ...(accountIds
        ? [{ operator: "in", column: "id", value: accountIds }]
        : [
          { operator: "eq", column: "links.company_id", value: "company-1" },
          { operator: "eq", column: "links.is_active", value: true },
        ]),
    ]);
    const notification = calls.find((call) => call.table === "partner_notifications");
    assert.equal((notification?.payload as Record<string, unknown>).company_id, "company-1");
  });
}

test("환경 설정 행이 없으면 기본값을 사용하고 불완전한 행의 관리자·파트너 opt-in 차이를 보존한다", async () => {
  const api = await operationalNotificationsModulePromise;
  installSupabase(() => ({ data: null, error: null }));
  assert.equal((await api.getAdminOperationalNotificationPreferences("admin-1")).enabled, true);
  assert.equal((await api.getPartnerOperationalNotificationPreferences("account-1")).enabled, true);
  installSupabase(() => ({ data: {}, error: null }));
  assert.equal((await api.getAdminOperationalNotificationPreferences("admin-1")).enabled, false);
  assert.equal((await api.getPartnerOperationalNotificationPreferences("account-1")).enabled, true);
});

test("dedupe 저장은 유일키 충돌만 중복으로 처리하고 해제는 예약 전체 식별자로 제한한다", async () => {
  const api = await operationalNotificationsModulePromise;
  const dedupe = { dedupeKey: "dedupe-1", audience: "admin" as const, notificationType: "security_alert", targetId: "target-1" };
  const calls: QueryCall[] = [];
  installSupabase((call) => { calls.push(call); return { error: null }; });
  assert.equal(await api.claimOperationalNotificationDedupe(dedupe), true);
  await api.releaseOperationalNotificationDedupe(dedupe);
  assert.deepEqual(calls[0].payload, {
    dedupe_key: "dedupe-1", audience: "admin", notification_type: "security_alert", target_id: "target-1",
  });
  assert.deepEqual(calls[1].filters, [
    { operator: "eq", column: "dedupe_key", value: "dedupe-1" },
    { operator: "eq", column: "audience", value: "admin" },
    { operator: "eq", column: "notification_type", value: "security_alert" },
    { operator: "eq", column: "target_id", value: "target-1" },
  ]);
  installSupabase(() => ({ error: { code: "23505", message: "duplicate" } }));
  assert.equal(await api.claimOperationalNotificationDedupe(dedupe), false);
  installSupabase(() => ({ error: { code: "08006", message: "storage unavailable" } }));
  await assert.rejects(api.claimOperationalNotificationDedupe(dedupe), /storage unavailable/);
});
