import assert from "node:assert/strict";
import test from "node:test";

import {
  getMattermostSenderGenerationOptions,
  isMattermostSenderGenerationAvailable,
} from "../src/lib/mattermost-senders/availability-rules.ts";

test("활성 Sender가 등록된 일반 기수만 선택할 수 있다", () => {
  assert.equal(isMattermostSenderGenerationAvailable(15, [15]), true);
  assert.equal(isMattermostSenderGenerationAvailable(16, [15]), false);
  assert.equal(isMattermostSenderGenerationAvailable(15, []), false);
});

test("운영진은 하나 이상의 활성 Sender가 있을 때만 선택할 수 있다", () => {
  assert.equal(isMattermostSenderGenerationAvailable(0, [15]), true);
  assert.equal(isMattermostSenderGenerationAvailable(0, []), false);
  assert.equal(isMattermostSenderGenerationAvailable(0, [0]), false);
});

test("가입 기수 목록은 운영진을 먼저 두고 모든 설정된 기수를 오름차순으로 정렬한다", () => {
  assert.deepEqual(
    getMattermostSenderGenerationOptions({
      activeSenderGenerations: [15, 14],
      configuredSenderGenerations: [16, 14],
      selectableSenderGenerations: [15, 17],
    }),
    [0, 14, 15, 16, 17],
  );
});

test("가입 기수 목록은 잘못된 값과 중복 값을 제거한다", () => {
  assert.deepEqual(
    getMattermostSenderGenerationOptions({
      activeSenderGenerations: [0, -1, 15, 15, Number.NaN],
      configuredSenderGenerations: [15, 16.5, 99],
      selectableSenderGenerations: [16, 100],
    }),
    [0, 15, 16, 99],
  );
});
