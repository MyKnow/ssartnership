import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import {
  MultipartRequestBodyError,
  readMultipartFormDataWithinLimit,
} from "../src/lib/request-body-limit.ts";
import { readRouteParam } from "../src/lib/route-params.ts";
import {
  MAX_STORED_USER_AGENT_LENGTH,
  normalizeUserAgentHeader,
} from "../src/lib/request-header-values.ts";

const URL_BASE = "https://ssartnership.example/api/upload-test";

function createStreamRequest(chunks: Uint8Array[], headers: Record<string, string>) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[index]);
      index += 1;
    },
  });
  return new Request(URL_BASE, {
    method: "POST",
    headers,
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

test("user agent는 제어문자를 공백으로 바꾸고 길이 상한을 적용한다", () => {
  assert.equal(normalizeUserAgentHeader(null), null);
  assert.equal(normalizeUserAgentHeader("   "), null);
  assert.equal(
    normalizeUserAgentHeader("Mozilla/5.0\r\nX-Injected: 1\u0000\u0085 Safari"),
    "Mozilla/5.0 X-Injected: 1 Safari",
  );
  const long = normalizeUserAgentHeader(`UA ${"x".repeat(2_000)}`);
  assert.equal(long?.length, MAX_STORED_USER_AGENT_LENGTH);
  const surrogate = normalizeUserAgentHeader(`${"a".repeat(9)}😀`, 10);
  assert.equal(surrogate, "a".repeat(9));
});

test("multipart reader는 선언된 길이가 한도를 넘으면 본문을 읽기 전에 거부한다", async () => {
  let pulled = false;
  const body = new ReadableStream<Uint8Array>(
    {
      pull() {
        pulled = true;
        throw new Error("body must not be read");
      },
    },
    { highWaterMark: 0 },
  );
  const request = new Request(URL_BASE, {
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=x",
      "content-length": String(10_000),
    },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  await assert.rejects(
    readMultipartFormDataWithinLimit(request, 1_024),
    (error: unknown) =>
      error instanceof MultipartRequestBodyError && error.code === "body_too_large",
  );
  assert.equal(pulled, false);
});

test("multipart reader는 길이를 선언하지 않은 스트림도 한도까지만 읽는다", async () => {
  const request = createStreamRequest(
    [new Uint8Array(800), new Uint8Array(800)],
    { "content-type": "multipart/form-data; boundary=x" },
  );

  await assert.rejects(
    readMultipartFormDataWithinLimit(request, 1_024),
    (error: unknown) =>
      error instanceof MultipartRequestBodyError && error.code === "body_too_large",
  );
});

test("multipart reader는 한도 안의 파일 필드를 FormData로 해석하고 잘못된 형식은 구분한다", async () => {
  const form = new FormData();
  form.set("xlsx", new File([new Uint8Array([1, 2, 3])], "members.xlsx"));
  const request = new Request(URL_BASE, { method: "POST", body: form });

  const parsed = await readMultipartFormDataWithinLimit(request, 64 * 1024);
  const file = parsed.get("xlsx");
  assert.ok(file instanceof File);
  assert.equal(file.size, 3);

  const malformed = createStreamRequest([new TextEncoder().encode("not multipart")], {
    "content-type": "multipart/form-data; boundary=missing",
  });
  await assert.rejects(
    readMultipartFormDataWithinLimit(malformed, 1_024),
    (error: unknown) =>
      error instanceof MultipartRequestBodyError && error.code === "invalid_form",
  );
});

test("요청 로그 문맥과 푸시 구독 저장은 user agent 정규화 helper를 거친다", async () => {
  const [activityLogs, memberPush, operationalPush] = await Promise.all(
    [
      "../src/lib/activity-logs.ts",
      "../src/lib/push/subscriptions.ts",
      "../src/lib/operational-notifications.ts",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  assert.equal(
    activityLogs.match(/userAgent: normalizeUserAgentHeader\(/g)?.length,
    2,
  );
  assert.match(memberPush, /user_agent: normalizeUserAgentHeader\(userAgent\)/);
  assert.match(operationalPush, /user_agent: normalizeUserAgentHeader\(input\.userAgent\)/);
});

test("동적 라우트 파라미터는 다시 decode하지 않고 비정상 값만 빈 문자열로 바꾼다", () => {
  assert.equal(readRouteParam("  coupon-1  "), "coupon-1");
  assert.equal(readRouteParam("100%"), "100%");
  assert.equal(readRouteParam("%2F"), "%2F");
  assert.equal(readRouteParam(["first", "second"]), "first");
  assert.equal(readRouteParam(undefined), "");
  assert.equal(readRouteParam("id\u0000x"), "");
  assert.equal(readRouteParam("x".repeat(129), 128), "");
  assert.equal(readRouteParam("x".repeat(128), 128), "x".repeat(128));
});

async function listRouteFiles(directory: URL): Promise<URL[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
      if (entry.isDirectory()) {
        return listRouteFiles(child);
      }
      return entry.name === "route.ts" || entry.name === "page.tsx" ? [child] : [];
    }),
  );
  return nested.flat();
}

test("route handler와 page는 Next가 디코딩한 params에 decodeURIComponent를 다시 적용하지 않는다", async () => {
  const routeFiles = await listRouteFiles(new URL("../src/app/", import.meta.url));
  assert.ok(routeFiles.length > 50);
  const offenders: string[] = [];
  for (const file of routeFiles) {
    const source = await readFile(file, "utf8");
    if (/decodeURIComponent\(/.test(source) && /params/.test(source)) {
      offenders.push(file.pathname);
    }
  }
  assert.deepEqual(offenders, []);
});
