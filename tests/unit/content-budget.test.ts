import { describe, expect, it } from "vitest";
import { applyContentBudget } from "@/lib/content-budget";

describe("content budget", () => {
  it("returns an immutable visible slice and hidden count", () => {
    const source = ["하나", "둘", "셋", "넷"];

    expect(applyContentBudget(source, 2)).toEqual({
      visible: ["하나", "둘"],
      hiddenCount: 2,
    });
    expect(source).toEqual(["하나", "둘", "셋", "넷"]);
  });

  it("normalizes negative, fractional and non-finite limits", () => {
    expect(applyContentBudget(["하나", "둘"], -1)).toEqual({
      visible: [],
      hiddenCount: 2,
    });
    expect(applyContentBudget(["하나", "둘"], 1.9)).toEqual({
      visible: ["하나"],
      hiddenCount: 1,
    });
    expect(applyContentBudget(["하나"], Number.NaN)).toEqual({
      visible: [],
      hiddenCount: 1,
    });
  });
});
