import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    "@/lib/supabase/server",
    `export function getSupabaseAdminClient() {
      return globalThis.__memberRecordDeletionSupabase;
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

type DeleteCall = { table: string; column: string; value: unknown };

function installSupabase(result: { error: { code?: string } | null }) {
  const calls: DeleteCall[] = [];
  (globalThis as Record<string, unknown>).__memberRecordDeletionSupabase = {
    from(table: string) {
      return {
        delete() {
          return {
            eq(column: string, value: unknown) {
              calls.push({ table, column, value });
              return Promise.resolve(result);
            },
          };
        },
      };
    },
  };
  return calls;
}

const lifecycleModulePromise = import(
  new URL("../src/lib/member-lifecycle.ts", import.meta.url).href
) as Promise<typeof import("../src/lib/member-lifecycle.ts")>;

test("관리자 회원 삭제는 members 행 하나만 PK로 삭제한다", async () => {
  const calls = installSupabase({ error: null });
  const { deleteMemberRecord } = await lifecycleModulePromise;

  assert.deepEqual(await deleteMemberRecord("member-1"), { ok: true });
  assert.deepEqual(calls, [{ table: "members", column: "id", value: "member-1" }]);
});

test("관리자 회원 삭제 실패는 DB 오류 코드만 돌려준다", async () => {
  installSupabase({ error: { code: "23503" } });
  const { deleteMemberRecord } = await lifecycleModulePromise;

  assert.deepEqual(await deleteMemberRecord("member-1"), {
    ok: false,
    errorCode: "23503",
  });
});

test("관리자 삭제 액션은 members 삭제를 lifecycle 모듈에 위임한다", () => {
  const action = readFileSync(
    new URL("../src/app/admin/(protected)/_actions/member-actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(action, /await deleteMemberRecord\(id\)/);
  assert.doesNotMatch(action, /\.from\("members"\)\.delete\(\)/);
});
