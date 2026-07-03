import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPartnerReviewPendingMessage,
  isPartnerReviewListRefreshing,
  type PartnerReviewPendingMode,
} from "../src/lib/partner-review-pending.ts";

describe("partner review pending helpers", () => {
  it("marks only list-refreshing modes as list refreshes", () => {
    const modes: PartnerReviewPendingMode[] = [
      "idle",
      "refresh",
      "loadMore",
      "delete",
      "moderate",
      "react",
    ];

    assert.deepEqual(
      Object.fromEntries(
        modes.map((mode) => [mode, isPartnerReviewListRefreshing(mode)]),
      ),
      {
        idle: false,
        refresh: true,
        loadMore: false,
        delete: true,
        moderate: true,
        react: false,
      },
    );
  });

  it("returns user-visible pending messages for each active mode", () => {
    assert.equal(getPartnerReviewPendingMessage("idle"), "");
    assert.match(getPartnerReviewPendingMessage("refresh"), /새로 불러오는 중/);
    assert.match(getPartnerReviewPendingMessage("loadMore"), /더 불러오는 중/);
    assert.match(getPartnerReviewPendingMessage("delete"), /삭제/);
    assert.match(getPartnerReviewPendingMessage("moderate"), /상태 변경/);
    assert.match(getPartnerReviewPendingMessage("react"), /반응/);
  });
});
