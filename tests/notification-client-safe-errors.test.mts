import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const notificationClientPromise = import(
  "../src/lib/notifications/client-request.ts"
);

test("회원 알림 요청은 브라우저 네트워크 오류를 안전한 코드와 메시지로 변환한다", async () => {
  const { requestNotificationJson } = await notificationClientPromise;
  const { ClientSafeRequestError } = await import(
    "../src/lib/client-safe-request-error.ts"
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };

  try {
    await assert.rejects(
      requestNotificationJson(
        "/api/notifications/member-1",
        { method: "PATCH" },
        { requestFailureMessage: "읽음 처리에 실패했습니다." },
      ),
      (error: unknown) => {
        assert.ok(error instanceof ClientSafeRequestError);
        assert.equal(error.code, "network_unavailable");
        assert.equal(
          error.message,
          "읽음 처리에 실패했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
        );
        assert.doesNotMatch(error.message, /Failed to fetch/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("파트너 알림 요청은 브라우저 네트워크 오류를 안전한 코드와 메시지로 변환한다", async () => {
  const { requestNotificationJson } = await notificationClientPromise;
  const { ClientSafeRequestError } = await import(
    "../src/lib/client-safe-request-error.ts"
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };

  try {
    await assert.rejects(
      requestNotificationJson(
        "/api/partner/notifications/partner-1",
        { method: "DELETE" },
        { requestFailureMessage: "알림 삭제에 실패했습니다." },
      ),
      (error: unknown) => {
        assert.ok(error instanceof ClientSafeRequestError);
        assert.equal(error.code, "network_unavailable");
        assert.equal(
          error.message,
          "알림 삭제에 실패했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
        );
        assert.doesNotMatch(error.message, /Failed to fetch/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("알림 요청은 알 수 없는 런타임 오류도 요청별 안전 메시지로 변환한다", async () => {
  const { requestNotificationJson } = await notificationClientPromise;
  const { ClientSafeRequestError } = await import(
    "../src/lib/client-safe-request-error.ts"
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("database relation notification_reads is unavailable");
  };

  try {
    await assert.rejects(
      requestNotificationJson(
        "/api/partner/notifications/partner-1",
        { method: "PATCH" },
        { requestFailureMessage: "읽음 처리에 실패했습니다." },
      ),
      (error: unknown) => {
        assert.ok(error instanceof ClientSafeRequestError);
        assert.equal(error.code, "request_failed");
        assert.equal(error.message, "읽음 처리에 실패했습니다.");
        assert.doesNotMatch(error.message, /notification_reads/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("알림 요청은 기존 HTTP 오류 메시지 계약을 유지한다", async () => {
  const { requestNotificationJson } = await notificationClientPromise;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ message: "권한을 확인해 주세요." }),
    { status: 403, headers: { "content-type": "application/json" } },
  );

  try {
    await assert.rejects(
      requestNotificationJson(
        "/api/notifications/member-1",
        { method: "DELETE" },
        { requestFailureMessage: "알림을 삭제하지 못했습니다." },
      ),
      /권한을 확인해 주세요/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("회원과 파트너 알림 센터는 공통 안전 요청 경계를 사용한다", async () => {
  const sources = await Promise.all([
    readFile(
      new URL("../src/components/notifications/NotificationInbox.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/components/partner/partner-notifications/PartnerNotificationCenter.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  for (const source of sources) {
    assert.match(source, /requestNotificationJson/);
    assert.match(source, /getNotificationClientError/);
    assert.doesNotMatch(
      source,
      /error instanceof Error \? error\.message/,
    );
  }
});
