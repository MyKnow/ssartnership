import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  invokeSelfHostCron,
  loadCronSchedules,
  parseCronSchedules,
  parseTrustedCronBaseUrl,
  SelfHostCronError,
} from "../scripts/lib/self-host-cron.mjs";
import { runSelfHostCronCli } from "../scripts/self-host-cron.mjs";

const configUrl = new URL("../vercel.json", import.meta.url);
const configSource = readFileSync(configUrl, "utf8");
const configuredCrons = JSON.parse(configSource).crons;
const schedules = loadCronSchedules(configSource);
const knownPath = schedules[0].path;

function expectCode(code: string) {
  return (error: unknown) => error instanceof SelfHostCronError && error.code === code;
}

function cronOptions(overrides = {}) {
  return {
    entries: schedules,
    path: knownPath,
    baseUrl: "http://app:3000",
    secret: randomBytes(32).toString("hex"),
    fetchImpl: async () => new Response(null, { status: 204 }),
    ...overrides,
  };
}

test("self-host cron 목록은 vercel.json의 모든 UTC 스케줄을 변경 없이 사용한다", async () => {
  assert.deepEqual(parseCronSchedules({ crons: configuredCrons }), configuredCrons);

  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runSelfHostCronCli({
    argv: ["--list"],
    readFile: () => configSource,
    stdout: (line: string) => stdout.push(line),
    stderr: (line: string) => stderr.push(line),
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(
    stdout,
    configuredCrons.map(
      ({ path, schedule }: { path: string; schedule: string }) =>
        `${path}\t${schedule} UTC`,
    ),
  );
  assert.deepEqual(stderr, []);
});

test("알 수 없는 명령과 cron 경로는 fetch 전에 거절한다", async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 204 });
  };

  const stderr: string[] = [];
  const unknownCommandExit = await runSelfHostCronCli({
    argv: ["--unknown"],
    fetchImpl,
    stderr: (line: string) => stderr.push(line),
  });
  assert.equal(unknownCommandExit, 1);
  assert.deepEqual(stderr, ["self-host-cron: CRON_CLI_USAGE"]);

  await assert.rejects(
    () =>
      invokeSelfHostCron(
        cronOptions({ path: "/api/cron/not-registered", fetchImpl }),
      ),
    expectCode("CRON_PATH_UNKNOWN"),
  );
  assert.equal(fetchCalls, 0);
});

test("cron 호출은 명시된 endpoint와 secret이 없으면 실행하지 않는다", async () => {
  let fetchCalls = 0;
  const fetchImpl = async () => {
    fetchCalls += 1;
    return new Response(null, { status: 204 });
  };

  await assert.rejects(
    () => invokeSelfHostCron(cronOptions({ baseUrl: "", fetchImpl })),
    expectCode("CRON_BASE_URL_MISSING"),
  );
  await assert.rejects(
    () => invokeSelfHostCron(cronOptions({ secret: "", fetchImpl })),
    expectCode("CRON_SECRET_MISSING"),
  );
  assert.equal(fetchCalls, 0);
});

test("cron endpoint는 HTTPS 또는 명시된 local/app HTTP origin만 허용한다", () => {
  assert.equal(
    parseTrustedCronBaseUrl("https://cron.example.com").origin,
    "https://cron.example.com",
  );
  assert.equal(
    parseTrustedCronBaseUrl("http://app:3000").origin,
    "http://app:3000",
  );
  assert.equal(
    parseTrustedCronBaseUrl("http://127.0.0.1:3000").origin,
    "http://127.0.0.1:3000",
  );
  assert.equal(
    parseTrustedCronBaseUrl("http://127.0.0.2:3000").origin,
    "http://127.0.0.2:3000",
  );

  for (const dangerousBaseUrl of [
    "http://cron.example.com",
    "https://user:password@cron.example.com",
    "https://cron.example.com/internal",
    "https://cron.example.com/?target=internal",
    "https://cron.example.com/#fragment",
    "https://cron.example.com/%2fapi%2fcron",
    "https://cron.example.com\\\\@attacker.example",
  ]) {
    assert.throws(
      () => parseTrustedCronBaseUrl(dangerousBaseUrl),
      expectCode("CRON_BASE_URL_UNTRUSTED"),
    );
  }
});

test("cron 구성은 고유한 안전 경로와 유효한 5필드 schedule만 허용한다", () => {
  assert.throws(
    () =>
      parseCronSchedules({
        crons: [
          { path: "/api/cron/rss", schedule: "0 0 * * *" },
          { path: "/api/cron/rss", schedule: "5 0 * * *" },
        ],
      }),
    expectCode("CRON_SCHEDULE_CONFIG_INVALID"),
  );
  assert.throws(
    () =>
      parseCronSchedules({
        crons: [{ path: "/api/cron/rss?unsafe", schedule: "61 0 * * *" }],
      }),
    expectCode("CRON_SCHEDULE_CONFIG_INVALID"),
  );
  for (const malformedSchedule of ["*/ * * * *", "0/ * * * *"]) {
    assert.throws(
      () =>
        parseCronSchedules({
          crons: [{ path: "/api/cron/rss", schedule: malformedSchedule }],
        }),
      expectCode("CRON_SCHEDULE_CONFIG_INVALID"),
    );
  }
});

test("cron 요청은 GET bearer, redirect 차단, non-2xx 거절을 사용한다", async () => {
  const credential = randomBytes(32).toString("hex");
  let capturedUrl: URL | undefined;
  let capturedInit: RequestInit | undefined;
  const result = await invokeSelfHostCron(
    cronOptions({
      secret: credential,
      fetchImpl: async (url: URL, init: RequestInit) => {
        capturedUrl = url;
        capturedInit = init;
        return new Response(null, { status: 204 });
      },
    }),
  );

  assert.equal(capturedUrl?.pathname, knownPath);
  assert.equal(capturedInit?.method, "GET");
  assert.equal(capturedInit?.redirect, "error");
  assert.equal(
    new Headers(capturedInit?.headers).get("authorization"),
    `Bearer ${credential}`,
  );
  assert.deepEqual(result, schedules[0]);

  await assert.rejects(
    () =>
      invokeSelfHostCron(
        cronOptions({
          fetchImpl: async () =>
            new Response(null, {
              status: 302,
              headers: { location: "https://attacker.example" },
            }),
        }),
      ),
    expectCode("CRON_RESPONSE_REJECTED"),
  );
  await assert.rejects(
    () =>
      invokeSelfHostCron(
        cronOptions({ fetchImpl: async () => new Response(null, { status: 500 }) }),
      ),
    expectCode("CRON_RESPONSE_REJECTED"),
  );
});

test("cron timeout과 오류 출력은 secret 또는 응답 본문을 노출하지 않는다", async () => {
  await assert.rejects(
    () =>
      invokeSelfHostCron(
        cronOptions({
          timeoutMs: 5,
          fetchImpl: async (_url: URL, init: RequestInit) =>
            new Promise((_, reject) => {
              init.signal?.addEventListener(
                "abort",
                () => reject(new Error("test-cron-secret must not be logged")),
                { once: true },
              );
            }),
        }),
      ),
    expectCode("CRON_INVOCATION_TIMEOUT"),
  );

  const stdout: string[] = [];
  const stderr: string[] = [];
  const secret = randomBytes(32).toString("hex");
  const exitCode = await runSelfHostCronCli({
    argv: ["--run", knownPath],
    env: {
      NODE_ENV: "test",
      SELF_HOST_CRON_BASE_URL: "http://app:3000",
      CRON_SECRET: secret,
    },
    fetchImpl: async () => new Response(secret, { status: 500 }),
    readFile: () => configSource,
    stdout: (line: string) => stdout.push(line),
    stderr: (line: string) => stderr.push(line),
  });

  assert.equal(exitCode, 1);
  assert.equal(`${stdout.join("\n")}\n${stderr.join("\n")}`.includes(secret), false);
  assert.deepEqual(stderr, ["self-host-cron: CRON_RESPONSE_REJECTED"]);
});
