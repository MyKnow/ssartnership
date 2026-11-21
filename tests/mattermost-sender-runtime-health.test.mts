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

const mockModules = new Map<string, string>([
  [
    "@/lib/mattermost/client",
    `export class MattermostApiError extends Error {
      constructor(code, status = null) {
        super(code);
        this.name = "MattermostApiError";
        this.code = code;
        this.status = status;
      }
    }
    export class MattermostAuthenticatedSession {}
    export class MattermostClient {
      async withAuthenticatedSender(_credentials, operation) {
        const scenario = globalThis.__senderRuntimeHealthScenario;
        if (scenario.loginError) {
          throw new MattermostApiError(scenario.loginError);
        }
        return operation({ user: { id: "sender-user" } });
      }
    }`,
  ],
  [
    "./config",
    `export function getMattermostSenderKeyring() {
      return { activeKeyVersion: 1, keys: new Map() };
    }`,
  ],
  [
    "./repository",
    `export const mattermostSenderRepository = {
      async getActiveSenderForGeneration(generation) {
        return {
          id: "sender-" + generation,
          generation,
          senderMattermostUserId: "sender-user",
          senderMattermostUsername: "sender",
          credentials: { loginId: "login", password: "password" },
        };
      },
      async recordHealthFailure(input) {
        globalThis.__senderRuntimeHealthRecorded.push(input);
      },
    };`,
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

const globals = globalThis as Record<string, unknown>;
const recorded: Array<{ senderId: string; errorCode: string }> = [];
globals.__senderRuntimeHealthRecorded = recorded;

const serviceModulePromise = import(
  new URL("../src/lib/mattermost-senders/service.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/mattermost-senders/service.ts")>;
const clientModulePromise = import("@/lib/mattermost/client") as Promise<{
  MattermostApiError: new (code: string) => Error & { code: string };
}>;

async function runScenario(scenario: {
  loginError?: string;
  operationError?: string;
}) {
  recorded.length = 0;
  globals.__senderRuntimeHealthScenario = scenario;
  const { withActiveMattermostSenderForGeneration } = await serviceModulePromise;
  const { MattermostApiError } = await clientModulePromise;
  await assert.rejects(
    withActiveMattermostSenderForGeneration(15, async () => {
      throw new MattermostApiError(scenario.operationError ?? "unavailable");
    }),
  );
  return [...recorded];
}

test("로그인 단계 403은 Sender 차단으로 기록한다", async () => {
  assert.deepEqual(await runScenario({ loginError: "forbidden" }), [
    { senderId: "sender-15", errorCode: "forbidden" },
  ]);
});

test("대상 작업 중 403과 요청 거부는 Sender health에 기록하지 않는다", async () => {
  assert.deepEqual(await runScenario({ operationError: "forbidden" }), []);
  assert.deepEqual(await runScenario({ operationError: "request_rejected" }), []);
  assert.deepEqual(await runScenario({ loginError: "request_rejected" }), []);
});

test("대상 작업 중 timeout·장애는 Sender cooldown 근거로 기록한다", async () => {
  assert.deepEqual(await runScenario({ operationError: "timeout" }), [
    { senderId: "sender-15", errorCode: "timeout" },
  ]);
  assert.deepEqual(await runScenario({ operationError: "unavailable" }), [
    { senderId: "sender-15", errorCode: "unavailable" },
  ]);
});
