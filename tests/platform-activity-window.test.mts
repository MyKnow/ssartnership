import assert from "node:assert/strict";
import test from "node:test";

import { formatActivityWindow } from "../src/lib/platform-activity-heatmap.ts";

test("활성 사용자 창은 기준일부터 전방 기간으로 표시한다", () => {
  assert.deepEqual(
    formatActivityWindow({
      anchorDate: "2026-07-21",
      windowDays: 7,
      observedThrough: "2026-07-23",
    }),
    {
      label: "2026.07.21 ~ 2026.07.27",
      observedLabel: "2026.07.21 ~ 2026.07.23",
      isComplete: false,
    },
  );
});
