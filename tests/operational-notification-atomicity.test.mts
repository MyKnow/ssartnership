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

type QueryOperation =
  | "delete"
  | "insert"
  | "select"
  | "update"
  | "upsert";

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
  ["@/lib/partner-portal", "export const isPartnerPortalMock = false;"],
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
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
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
  (globalThis as Record<string, unknown>).__operationalNotificationTestSupabase =
    supabase;
  return supabase;
}

function setPushConfigured(configured: boolean) {
  (
    globalThis as Record<string, unknown>
  ).__operationalNotificationTestPushConfigured = configured;
}

type OperationalNotificationsModule =
  typeof import("../src/lib/operational-notifications.ts");

const operationalNotificationsModulePromise = import(
  new URL("../src/lib/operational-notifications.ts", import.meta.url).href
) as Promise<OperationalNotificationsModule>;

function notificationInsertResult(call: QueryCall, audience: "admin" | "partner") {
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

test("관리자 프로필 조회가 실패하면 먼저 만든 기본 알림을 삭제한다", async () => {
  const calls: QueryCall[] = [];
  installSupabase((call) => {
    calls.push(call);
    const inserted = notificationInsertResult(call, "admin");
    if (inserted) return inserted;
    if (call.table === "admin_profiles") {
      return { data: null, error: { message: "profile lookup failed" } };
    }
    return { data: null, error: null };
  });
  setPushConfigured(false);

  const { createAdminOperationalNotification } =
    await operationalNotificationsModulePromise;
  await assert.rejects(
    createAdminOperationalNotification({
      type: "security_alert",
      title: "보안 알림",
      body: "프로필 조회 실패",
      requestedChannels: ["portal"],
    }),
    /profile lookup failed/,
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
      if (call.table === "admin_profiles") {
        return { data: [{ member_id: "admin-1" }], error: null };
      }
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
      if (call.table === "admin_profiles") {
        return { data: null, error: { message: "profile lookup failed" } };
      }
      if (call.table === "partner_accounts") {
        return { data: null, error: { message: "account lookup failed" } };
      }
      return { data: null, error: null };
    });
    setPushConfigured(false);

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
      assert.ok(error instanceof OperationalNotificationPersistenceUncertainError);
      assert.ok(error.cause instanceof AggregateError);
      assert.deepEqual(
        error.cause.errors.map((cause) =>
          cause instanceof Error ? cause.message : String(cause),
        ),
        [
          audience === "admin"
            ? "profile lookup failed"
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
      if (call.table === "admin_profiles") {
        return { data: [{ member_id: "admin-1" }], error: null };
      }
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
