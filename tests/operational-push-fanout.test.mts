import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";

/**
 * 관리자·파트너 운영 알림의 웹 푸시 팬아웃 동작 고정 테스트.
 * 두 경로가 한 함수로 합쳐져도 테이블·소유자 컬럼·템플릿 키·만료 구독 정리·
 * delivery 기록이 대상별로 그대로인지 확인한다.
 */

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

process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public-key";
process.env.VAPID_PRIVATE_KEY = "test-private-key";
process.env.VAPID_SUBJECT = "mailto:test@example.com";

const subscriptionTrustMock = `export async function buildTrustedPushSubscriptionRequest(input) {
  return { endpoint: input.endpoint, keys: { p256dh: input.p256dh, auth: input.auth } };
}
export async function validateTrustedPushSubscription(input) {
  return {
    endpoint: input.endpoint,
    p256dh: input.keys?.p256dh ?? "",
    auth: input.keys?.auth ?? "",
    expirationTime: null,
  };
}`;

const mockModules = new Map<string, string>([
  [
    "@/lib/supabase/server",
    `export function getSupabaseAdminClient() {
      return globalThis.__operationalPushFanoutSupabase;
    }`,
  ],
  [
    "@/lib/notification-templates/repository.server",
    `export async function resolveNotificationTemplate(key) {
      globalThis.__operationalPushFanoutTemplateKeys.push(key);
      return { titleTemplate: "렌더 제목", bodyTemplate: "렌더 본문" };
    }`,
  ],
  [
    "@/lib/admin-accounts",
    `export async function listAdminAccounts() {
      return [{ id: "admin-1", isActive: true, permissions: { notifications: { read: true } } }];
    }`,
  ],
  [
    "@/lib/partner-email",
    `export async function sendPartnerOperationalNotificationEmail() {
      return undefined;
    }`,
  ],
  ["@/lib/partner-portal", "export const isPartnerPortalMock = false;"],
  [
    "web-push",
    `export function setVapidDetails() {}
    export async function sendNotification(subscription, payload, options) {
      return globalThis.__operationalPushFanoutSend(subscription, payload, options);
    }`,
  ],
  ["@/lib/push/subscription-trust", subscriptionTrustMock],
  ["./subscription-trust.ts", subscriptionTrustMock],
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

type QueryOperation = "delete" | "insert" | "select" | "update" | "upsert";
type QueryFilter = { operator: "eq" | "in" | "is"; column: string; value: unknown };
type QueryCall = {
  table: string;
  operation: QueryOperation;
  payload?: unknown;
  filters: QueryFilter[];
};
type QueryResult = { data?: unknown; error?: { message: string } | null };

class FakeQuery {
  private operation: QueryOperation = "select";
  private payload: unknown;
  private readonly filters: QueryFilter[] = [];
  private readonly table: string;
  private readonly handler: (call: QueryCall) => QueryResult;

  constructor(table: string, handler: (call: QueryCall) => QueryResult) {
    this.table = table;
    this.handler = handler;
  }

  insert(payload: unknown) {
    this.operation = "insert";
    this.payload = payload;
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

  delete() {
    this.operation = "delete";
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

  is(column: string, value: unknown) {
    this.filters.push({ operator: "is", column, value });
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

type SendCall = {
  endpoint: string;
  payload: Record<string, unknown>;
  options: Record<string, unknown> | undefined;
};

const globals = globalThis as Record<string, unknown>;

function installFixture(audience: "admin" | "partner") {
  const calls: QueryCall[] = [];
  const sends: SendCall[] = [];
  const templateKeys: string[] = [];
  const ownerColumn = audience === "admin" ? "admin_id" : "account_id";
  const ownerId = audience === "admin" ? "admin-1" : "account-1";

  globals.__operationalPushFanoutTemplateKeys = templateKeys;
  globals.__operationalPushFanoutSend = async (
    subscription: { endpoint: string },
    payload: string,
    options?: Record<string, unknown>,
  ) => {
    sends.push({
      endpoint: subscription.endpoint,
      payload: JSON.parse(payload) as Record<string, unknown>,
      options,
    });
    if (subscription.endpoint.endsWith("/gone")) {
      throw Object.assign(new Error("push subscription gone"), { statusCode: 410 });
    }
    if (subscription.endpoint.endsWith("/server-error")) {
      throw Object.assign(new Error("push service error"), { statusCode: 500 });
    }
    return { statusCode: 201 };
  };
  globals.__operationalPushFanoutSupabase = {
    from(table: string) {
      return new FakeQuery(table, (call) => {
        calls.push(call);
        if (table === `${audience}_notifications` && call.operation === "insert") {
          return { data: { id: `${audience}-notification-1` }, error: null };
        }
        if (table === "admin_notification_preferences") {
          return { data: [], error: null };
        }
        if (table === "partner_accounts") {
          return {
            data: [
              {
                id: ownerId,
                display_name: "담당자",
                email: "partner@example.com",
                login_id: "partner",
                preferences: null,
              },
            ],
            error: null,
          };
        }
        if (table === `${audience}_push_subscriptions` && call.operation === "select") {
          return {
            data: ["ok", "gone", "server-error"].map((suffix) => ({
              id: `subscription-${suffix}`,
              [ownerColumn]: ownerId,
              endpoint: `https://fcm.googleapis.com/fcm/send/${suffix}`,
              p256dh: `p256dh-${suffix}`,
              auth: `auth-${suffix}`,
            })),
            error: null,
          };
        }
        return { data: null, error: null };
      });
    },
  };

  return { calls, sends, templateKeys, ownerColumn, ownerId };
}

const operationalModulePromise = import(
  new URL("../src/lib/operational-notifications.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/operational-notifications.ts")>;

const scenarios = [
  {
    audience: "admin" as const,
    type: "security_alert",
    targetUrl: "/admin/notifications",
    templateKey: "push.admin_operational.security_alert",
  },
  {
    audience: "partner" as const,
    type: "plan_changed",
    targetUrl: "/partner/notifications",
    templateKey: "push.partner_operational.plan_changed",
  },
];

for (const scenario of scenarios) {
  test(`${scenario.audience} 운영 푸시는 활성 구독마다 한 번 발송하고 결과를 대상 테이블에 기록한다`, async () => {
    const fixture = installFixture(scenario.audience);
    const {
      createAdminOperationalNotification,
      createPartnerOperationalNotification,
    } = await operationalModulePromise;

    const result =
      scenario.audience === "admin"
        ? await createAdminOperationalNotification({
            type: "security_alert",
            title: "원본 제목",
            body: "원본 본문",
            requestedChannels: ["push"],
          })
        : await createPartnerOperationalNotification({
            type: "plan_changed",
            companyId: "company-1",
            title: "원본 제목",
            body: "원본 본문",
            requestedChannels: ["push"],
          });

    const notificationId = `${scenario.audience}-notification-1`;
    assert.equal(result.notificationId, notificationId);
    assert.ok(fixture.templateKeys.includes(scenario.templateKey));

    const subscriptionQuery = fixture.calls.find(
      (call) =>
        call.table === `${scenario.audience}_push_subscriptions` &&
        call.operation === "select",
    );
    assert.deepEqual(subscriptionQuery?.filters, [
      { operator: "in", column: fixture.ownerColumn, value: [fixture.ownerId] },
      { operator: "eq", column: "is_active", value: true },
    ]);

    assert.deepEqual(
      fixture.sends.map((send) => send.endpoint).sort(),
      [
        "https://fcm.googleapis.com/fcm/send/gone",
        "https://fcm.googleapis.com/fcm/send/ok",
        "https://fcm.googleapis.com/fcm/send/server-error",
      ],
    );
    for (const send of fixture.sends) {
      assert.deepEqual(send.payload, {
        title: "렌더 제목",
        body: "렌더 본문",
        url: scenario.targetUrl,
        tag: `${scenario.type}:${notificationId}`,
        type: scenario.type,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      });
    }

    const subscriptionUpdates = new Map(
      fixture.calls
        .filter(
          (call) =>
            call.table === `${scenario.audience}_push_subscriptions` &&
            call.operation === "update",
        )
        .map((call) => [
          call.filters.find((filter) => filter.column === "id")?.value,
          call.payload as Record<string, unknown>,
        ]),
    );
    assert.ok(subscriptionUpdates.get("subscription-ok")?.last_success_at);
    assert.equal(subscriptionUpdates.get("subscription-ok")?.failure_reason, null);
    assert.equal(subscriptionUpdates.get("subscription-gone")?.is_active, false);
    assert.equal(
      "is_active" in (subscriptionUpdates.get("subscription-server-error") ?? {}),
      false,
      "5xx 실패는 구독을 비활성화하지 않는다",
    );

    const deliveries = fixture.calls
      .filter(
        (call) =>
          call.table === `${scenario.audience}_notification_deliveries` &&
          call.operation === "insert",
      )
      .map((call) => call.payload as Record<string, unknown>);
    assert.equal(deliveries.length, 3);
    for (const delivery of deliveries) {
      assert.equal(delivery.notification_id, notificationId);
      assert.equal(delivery[fixture.ownerColumn], fixture.ownerId);
      assert.equal(delivery.channel, "push");
    }
    assert.deepEqual(
      deliveries.map((delivery) => delivery.status).sort(),
      ["failed", "failed", "sent"],
    );
    assert.ok(
      deliveries
        .filter((delivery) => delivery.status === "failed")
        .every((delivery) => typeof delivery.error_message === "string" && delivery.error_message),
    );
  });
}
