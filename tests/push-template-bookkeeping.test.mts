import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import test from "node:test";
import { readFile } from "node:fs/promises";

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

type QueryOperation = "insert" | "select" | "update";

type QueryCall = {
  table: string;
  operation: QueryOperation;
  payload?: unknown;
  filters: Array<{
    column: string;
    value: unknown;
  }>;
};

type QueryResult = {
  count?: number | null;
  data?: unknown;
  error?: { message: string; code?: string } | null;
};

type QueryHandler = (call: QueryCall) => QueryResult | Promise<QueryResult>;

const mockModules = new Map<string, string>([
  [
    "@/lib/supabase/server",
    `export function getSupabaseAdminClient() {
      return globalThis.__pushTemplateBookkeepingSupabase;
    }`,
  ],
  [
    "../supabase/server.ts",
    `export function getSupabaseAdminClient() {
      return globalThis.__pushTemplateBookkeepingSupabase;
    }`,
  ],
  [
    "@/lib/repositories",
    `export const notificationRepository = {
      async createNotification() {
        throw new Error("sendPushTemplateTest should not create in-app notifications");
      },
      async addNotificationAudienceRecipients() {
        throw new Error("sendPushTemplateTest should not attach notification recipients");
      },
      async updateNotificationMetadata() {
        throw new Error("sendPushTemplateTest should not update notification metadata");
      },
      async recordNotificationDelivery() {
        throw new Error("sendPushTemplateTest should not record in-app notification delivery");
      },
    };`,
  ],
  [
    "@/lib/repositories/index.ts",
    `export const notificationRepository = {
      async createNotification() {
        throw new Error("sendPushTemplateTest should not create in-app notifications");
      },
      async addNotificationAudienceRecipients() {
        throw new Error("sendPushTemplateTest should not attach notification recipients");
      },
      async updateNotificationMetadata() {
        throw new Error("sendPushTemplateTest should not update notification metadata");
      },
      async recordNotificationDelivery() {
        throw new Error("sendPushTemplateTest should not record in-app notification delivery");
      },
    };`,
  ],
  [
    "web-push",
    `export function setVapidDetails() {}
    export async function sendNotification(subscription, payload) {
      return globalThis.__pushTemplateBookkeepingSendNotification(subscription, payload);
    }`,
  ],
  [
    "./subscription-trust.ts",
    `export async function buildTrustedPushSubscriptionRequest(input) {
      return {
        endpoint: input.endpoint,
        expirationTime: null,
        keys: {
          p256dh: input.p256dh,
          auth: input.auth,
        },
      };
    }`,
  ],
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

  update(payload: unknown) {
    this.operation = "update";
    this.payload = payload;
    return this;
  }

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  single() {
    return this.execute();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
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
  (
    globalThis as Record<string, unknown>
  ).__pushTemplateBookkeepingSupabase = {
    from(table: string) {
      return new FakeQuery(table, handler);
    },
  };
}

function setSendNotification(
  handler: (subscription: unknown, payload: unknown) => Promise<unknown>,
) {
  (
    globalThis as Record<string, unknown>
  ).__pushTemplateBookkeepingSendNotification = handler;
}

function buildMessageLog() {
  return {
    id: "message-log-1",
    type: "announcement",
    source: "manual",
    target_scope: "member",
    target_label: "템플릿 테스트 수신 회원",
    target_year: null,
    target_campus: null,
    target_member_id: "member-1",
    title: "테스트 제목",
    body: "테스트 본문",
    url: "/notifications",
    status: "pending",
    targeted: 0,
    delivered: 0,
    failed: 0,
    created_at: "2026-08-31T00:00:00.000Z",
    completed_at: null,
  };
}

type PushSendModule = typeof import("../src/lib/push/send.ts");

const pushSendModulePromise = import(
  new URL("../src/lib/push/send.ts", import.meta.url).href
) as Promise<PushSendModule>;

test("push 로그 mutation은 Supabase error를 삼키지 않는다", async () => {
  const source = await readFile(
    new URL("../src/lib/push/logs.ts", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /const \{ error \} = await supabase\.from\("push_delivery_logs"\)\.insert\(/,
  );
  assert.match(
    source,
    /const \{ error \} = await supabase\s+\.from\("push_message_logs"\)\s+\.update\(/,
  );
  assert.match(
    source,
    /const \{ error \} = await supabase\s+\.from\("push_subscriptions"\)\s+\.update\(/,
  );
  assert.match(source, /assertPushMutationSucceeded\(error, "Push 전송 로그를 저장하지 못했습니다."\)/);
  assert.match(source, /assertPushMutationSucceeded\(error, "Push 메시지 로그를 갱신하지 못했습니다."\)/);
  assert.match(source, /assertPushMutationSucceeded\(error, "Push 구독 상태를 갱신하지 못했습니다."\)/);
  assert.match(source, /assertPushMutationSucceeded\(error, "Push 구독 실패 상태를 저장하지 못했습니다."\)/);
});

test("템플릿 테스트 발송은 성공 후 bookkeeping 오류를 배송 실패로 오인하지 않는다", async (t) => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public";
  process.env.VAPID_PRIVATE_KEY = "test-private";
  process.env.VAPID_SUBJECT = "mailto:test@example.com";

  const calls: QueryCall[] = [];
  installSupabase((call) => {
    calls.push(call);
    if (call.table === "push_subscriptions" && call.operation === "select") {
      return {
        data: [
          {
            id: "subscription-1",
            member_id: "member-1",
            endpoint: "https://push.example.test/subscriptions/1",
            p256dh: "p256dh-key",
            auth: "auth-key",
          },
        ],
        error: null,
      };
    }
    if (call.table === "push_message_logs" && call.operation === "insert") {
      return { data: buildMessageLog(), error: null };
    }
    if (call.table === "push_subscriptions" && call.operation === "update") {
      return { data: null, error: { message: "subscription update failed" } };
    }
    if (call.table === "push_delivery_logs" && call.operation === "insert") {
      return { data: null, error: null };
    }
    if (call.table === "push_message_logs" && call.operation === "update") {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
  setSendNotification(async () => undefined);

  const errors: string[] = [];
  t.mock.method(console, "error", (...args: unknown[]) => {
    errors.push(args.map((value) => String(value)).join(" "));
  });

  const { sendPushTemplateTest } = await pushSendModulePromise;
  const result = await sendPushTemplateTest({
    memberId: "member-1",
    payload: {
      type: "announcement",
      title: "테스트 제목",
      body: "테스트 본문",
      url: "/notifications",
    },
  });

  assert.deepEqual(result, {
    targeted: 1,
    delivered: 1,
    failed: 0,
  });
  assert.ok(
    errors.some(
      (entry) =>
        entry.includes("[push] sent delivery bookkeeping failed") &&
        entry.includes("Push 구독 상태를 갱신하지 못했습니다."),
    ),
    "성공 후 bookkeeping 오류는 콘솔에 보고되어야 합니다.",
  );
  assert.ok(
    calls.some(
      (call) =>
        call.table === "push_message_logs" &&
        call.operation === "update" &&
        typeof call.payload === "object" &&
        call.payload !== null &&
        "status" in call.payload &&
        call.payload.status === "sent",
    ),
  );
});

test("템플릿 테스트 발송도 410 구독을 비활성화한다", async () => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public";
  process.env.VAPID_PRIVATE_KEY = "test-private";
  process.env.VAPID_SUBJECT = "mailto:test@example.com";

  const calls: QueryCall[] = [];
  installSupabase((call) => {
    calls.push(call);
    if (call.table === "push_subscriptions" && call.operation === "select") {
      return {
        data: [
          {
            id: "subscription-410",
            member_id: "member-1",
            endpoint: "https://push.example.test/subscriptions/410",
            p256dh: "p256dh-key",
            auth: "auth-key",
          },
        ],
        error: null,
      };
    }
    if (call.table === "push_message_logs" && call.operation === "insert") {
      return { data: buildMessageLog(), error: null };
    }
    if (call.table === "push_subscriptions" && call.operation === "update") {
      return { data: null, error: null };
    }
    if (call.table === "push_delivery_logs" && call.operation === "insert") {
      return { data: null, error: null };
    }
    if (call.table === "push_message_logs" && call.operation === "update") {
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
  setSendNotification(async () => {
    const error = new Error("Gone") as Error & { statusCode: number };
    error.statusCode = 410;
    throw error;
  });

  const { sendPushTemplateTest } = await pushSendModulePromise;
  const result = await sendPushTemplateTest({
    memberId: "member-1",
    payload: {
      type: "announcement",
      title: "테스트 제목",
      body: "테스트 본문",
      url: "/notifications",
    },
  });

  assert.deepEqual(result, {
    targeted: 1,
    delivered: 0,
    failed: 1,
  });
  assert.ok(
    calls.some(
      (call) =>
        call.table === "push_subscriptions" &&
        call.operation === "update" &&
        typeof call.payload === "object" &&
        call.payload !== null &&
        "is_active" in call.payload &&
        call.payload.is_active === false,
    ),
    "410 응답은 구독을 비활성화해야 합니다.",
  );
});
