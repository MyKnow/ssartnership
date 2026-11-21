import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

type ExperienceTabModule =
  typeof import("../src/components/project-showcase/experience-tab.ts");

const modulePromise = import(
  new URL("../src/components/project-showcase/experience-tab.ts", import.meta.url).href
) as Promise<ExperienceTabModule>;

function createTab(options: { failAssign?: boolean; failClose?: boolean } = {}) {
  const events: string[] = [];
  const tab = {
    opener: {} as unknown,
    close() {
      events.push("close");
      if (options.failClose) throw new Error("closed");
    },
    location: {
      assign(url: string) {
        events.push(`assign:${url}`);
        if (options.failAssign) throw new Error("blocked");
      },
    },
  };
  return { tab, events };
}

test("대기 탭은 opener를 끊고, 팝업이 막히면 null을 돌려준다", async () => {
  const { openPendingExperienceTab } = await modulePromise;
  const { tab } = createTab();

  const opened = openPendingExperienceTab(() => tab);
  assert.equal(opened, tab);
  assert.equal(tab.opener, null);

  assert.equal(openPendingExperienceTab(() => null), null);
  assert.equal(
    openPendingExperienceTab(() => {
      throw new Error("blocked");
    }),
    null,
  );
});

test("대기 탭 이동이 막히면 탭을 닫고 차단으로 알린다", async () => {
  const { navigatePendingExperienceTab } = await modulePromise;

  const opened = createTab();
  assert.equal(
    navigatePendingExperienceTab(opened.tab, "https://example.com/app"),
    "opened",
  );
  assert.deepEqual(opened.events, ["assign:https://example.com/app"]);

  assert.equal(navigatePendingExperienceTab(null, "https://example.com/app"), "blocked");

  const failing = createTab({ failAssign: true });
  assert.equal(
    navigatePendingExperienceTab(failing.tab, "https://example.com/app"),
    "blocked",
  );
  assert.deepEqual(failing.events, ["assign:https://example.com/app", "close"]);
});

test("대기 탭 닫기는 이미 닫힌 탭에서도 예외를 내지 않는다", async () => {
  const { closePendingExperienceTab } = await modulePromise;
  const failing = createTab({ failClose: true });

  assert.doesNotThrow(() => closePendingExperienceTab(failing.tab));
  assert.doesNotThrow(() => closePendingExperienceTab(null));
});

test("체험 패널은 차단 시 같은 조건의 window.open 재시도 대신 수동 링크를 안내한다", async () => {
  const source = await readFile(
    new URL("../src/components/project-showcase/ShowcaseExperiencePanel.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /window\.open\(result\.destination/);
  assert.match(source, /navigatePendingExperienceTab\(tab, result\.destination\)/);
  assert.match(source, /setBlockedDestination\(navigation === "blocked" \? result\.destination : null\)/);
  assert.match(source, /브라우저가 새 탭 열기를 막았어요/);
  assert.match(source, /closePendingExperienceTab\(tab\);\s*fail\(EXPERIENCE_START_FAILED_MESSAGE\)/);
});
