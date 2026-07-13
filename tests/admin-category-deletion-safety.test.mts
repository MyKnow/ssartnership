import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("admin category deletion safety", () => {
  it("blocks category deletion until an atomic database guard exists", async () => {
    const source = await readFile(
      new URL(
        "../src/app/admin/(protected)/_actions/catalog-actions.ts",
        import.meta.url,
      ),
      "utf8",
    );
    const deleteAction = source.slice(source.indexOf("deleteCategoryAction"));
    const nextAction = deleteAction.indexOf(
      "export async function createPartnerCompanyAction",
    );
    const categoryDeleteAction = deleteAction.slice(0, nextAction);

    assert.match(categoryDeleteAction, /"category_delete_deferred"/);
    assert.doesNotMatch(categoryDeleteAction, /\.delete\(\)/);
  });

  it("shows category usage while keeping destructive deletion locked in the UI", async () => {
    const source = await readFile(
      new URL(
        "../src/components/admin/AdminCategoryManager.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    assert.match(source, /usageCountById/);
    assert.match(source, /삭제 잠금/);
    assert.doesNotMatch(source, /pendingText="삭제 중"/);
  });
});
