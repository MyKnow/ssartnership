import assert from "node:assert/strict";
import test from "node:test";

import { isMattermostSenderGenerationAvailable } from "../src/lib/mattermost-senders/availability-rules.ts";

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
