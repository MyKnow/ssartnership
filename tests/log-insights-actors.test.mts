import assert from "node:assert/strict";
import test from "node:test";

import { resolveActorMeta } from "@/lib/log-insights/data";
import type { MemberLookupRecord } from "@/lib/log-insights/shared";

test("정규화된 회원 lookup에서 로그 작성자 표시를 복원한다", () => {
  const memberLookup = new Map<string, MemberLookupRecord>([
    [
      "member-1",
      {
        id: "member-1",
        displayName: "서울_김싸피",
        mattermostUsername: "ssafy15",
        actorName: "김싸피",
      },
    ],
  ]);

  assert.deepEqual(resolveActorMeta("member", "member-1", memberLookup), {
    actor_name: "김싸피",
    actor_mm_username: "ssafy15",
  });
});
