import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MockPartnerRepository } from "../src/lib/repositories/mock/partner-repository.mock.ts";

const root = new URL("..", import.meta.url);

const CATEGORY_OPTION_CALLERS = [
  "src/app/admin/(protected)/partners/new/actions.ts",
  "src/app/admin/(protected)/partners/new/template/route.ts",
  "src/app/partner/companies/[companyId]/services/new/page.tsx",
  "src/app/(site)/partner-registration/page.tsx",
  "src/app/(site)/partner-registration/template/route.ts",
  "src/lib/partner-registration-submit.server.ts",
];

test("mock 저장소 카테고리 옵션은 공개 카테고리 순서와 key를 id로 유지한다", async () => {
  const repository = new MockPartnerRepository();
  const [categories, options] = await Promise.all([
    repository.getCategories(),
    repository.getCategoryOptions(),
  ]);

  assert.ok(options.length > 0);
  assert.deepEqual(
    options,
    categories.map((category) => ({
      id: category.key,
      key: category.key,
      label: category.label,
    })),
  );
});

test("카테고리 id·key·label 조회는 저장소 메서드 한 곳만 사용한다", async () => {
  const [repositorySource, ...callerSources] = await Promise.all([
    readFile(
      new URL("src/lib/repositories/supabase/partner-repository.supabase.ts", root),
      "utf8",
    ),
    ...CATEGORY_OPTION_CALLERS.map((path) => readFile(new URL(path, root), "utf8")),
  ]);

  assert.match(
    repositorySource,
    /async getCategoryOptions\(\)[\s\S]{0,200}\.from\("categories"\)\s*\.select\("id,key,label"\)/,
  );
  for (const [index, source] of callerSources.entries()) {
    const path = CATEGORY_OPTION_CALLERS[index];
    assert.match(source, /partnerRepository\.getCategoryOptions\(\)/, path);
    assert.doesNotMatch(source, /\.select\("id,key,label"\)/, path);
  }
  assert.doesNotMatch(
    callerSources[3] ?? "",
    /NEXT_PUBLIC_DATA_SOURCE/,
    "공개 등록 화면은 mock 분기를 저장소 선택에 맡긴다",
  );
});
