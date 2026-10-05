import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("이벤트 보상 타입 모듈은 런타임 의존성 없이 클라이언트 컴포넌트에 타입만 제공한다", async () => {
  const [typesSource, rewardsSource, landing, pageView, stories] = await Promise.all([
    read("src/lib/promotions/event-rewards-types.ts"),
    read("src/lib/promotions/event-rewards.ts"),
    read("src/components/events/EventLanding.tsx"),
    read("src/components/events/EventPageView.tsx"),
    read("src/components/events/EventPageView.stories.tsx"),
  ]);

  const importLines = typesSource
    .split("\n")
    .filter((line) => line.startsWith("import "));
  assert.ok(importLines.length > 0);
  for (const line of importLines) {
    assert.match(line, /^import type /);
  }
  assert.doesNotMatch(typesSource, /getSupabaseAdminClient|node:crypto/);

  assert.match(rewardsSource, /export type \* from "@\/lib\/promotions\/event-rewards-types";/);

  for (const source of [landing, pageView, stories]) {
    assert.match(
      source,
      /import type \{ EventRewardSummary \} from "@\/lib\/promotions\/event-rewards-types";/,
    );
    assert.doesNotMatch(source, /from "@\/lib\/promotions\/event-rewards";/);
  }
});
