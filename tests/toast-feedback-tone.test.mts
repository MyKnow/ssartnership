import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const toastOptionsModulePromise = import(
  new URL("../src/components/ui/toast-options.ts", import.meta.url).href
) as Promise<typeof import("../src/components/ui/toast-options.ts")>;

test("토스트 기본값은 기존 안내 톤·status·2.5초를 유지한다", async () => {
  const { resolveToastOptions, DEFAULT_TOAST_DURATION_MS } =
    await toastOptionsModulePromise;

  assert.deepEqual(resolveToastOptions(), {
    tone: "info",
    role: "status",
    durationMs: DEFAULT_TOAST_DURATION_MS,
  });
  assert.equal(DEFAULT_TOAST_DURATION_MS, 2_500);
  assert.deepEqual(resolveToastOptions({ tone: "success" }), {
    tone: "success",
    role: "status",
    durationMs: 2_500,
  });
});

test("실패 토스트는 alert 역할과 6초 노출을 기본으로 쓴다", async () => {
  const { resolveToastOptions } = await toastOptionsModulePromise;

  assert.deepEqual(resolveToastOptions({ tone: "error" }), {
    tone: "error",
    role: "alert",
    durationMs: 6_000,
  });
});

test("토스트 노출 시간은 1~15초로 제한하고 잘못된 톤은 안내 톤으로 되돌린다", async () => {
  const { resolveToastOptions } = await toastOptionsModulePromise;

  assert.equal(resolveToastOptions({ durationMs: 10 }).durationMs, 1_000);
  assert.equal(resolveToastOptions({ durationMs: 60_000 }).durationMs, 15_000);
  assert.equal(resolveToastOptions({ durationMs: 3_200.4 }).durationMs, 3_200);
  assert.equal(
    resolveToastOptions({ tone: "error", durationMs: Number.NaN }).durationMs,
    6_000,
  );
  assert.equal(
    resolveToastOptions({ tone: "warning" as never }).tone,
    "info",
  );
});

test("Toast 뷰포트는 기존 마크업 계약을 유지하고 톤별 live region을 렌더한다", async () => {
  const source = await readFile(
    new URL("../src/components/ui/Toast.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /data-toast-viewport/);
  assert.match(source, /ui-toast-glass/);
  assert.match(source, /data-toast-tone=\{toast\.tone\}/);
  assert.match(source, /role=\{toast\.role\}/);
  assert.match(source, /resolveToastOptions\(options\)/);
});

function collectNotifyCalls(source: string) {
  const calls: string[] = [];
  let index = source.indexOf("notify(");
  while (index !== -1) {
    let depth = 0;
    let cursor = index + "notify".length;
    for (; cursor < source.length; cursor += 1) {
      const character = source[cursor];
      if (character === "(") depth += 1;
      if (character === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    calls.push(source.slice(index, cursor + 1));
    index = source.indexOf("notify(", cursor);
  }
  return calls;
}

test("실패를 알리는 notify 호출은 error 톤을 명시한다", async () => {
  const files = execFileSync("git", ["grep", "-l", "notify(", "--", "src"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".stories.tsx"));
  const failurePattern =
    /실패했습니다|하지 못했습니다|지 못했습니다|ClientError\(|getSafeAdminMessage\(|getErrorMessage\(|getResponseMessage\(/;
  const missing: string[] = [];

  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    for (const call of collectNotifyCalls(source)) {
      if (failurePattern.test(call) && !/tone: "error"/.test(call)) {
        missing.push(`${file}: ${call.replace(/\s+/g, " ").slice(0, 120)}`);
      }
    }
  }

  assert.deepEqual(missing, []);
});
