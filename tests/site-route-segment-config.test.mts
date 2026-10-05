import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../src/app/(site)/", import.meta.url);

async function listPageFiles(directory: URL): Promise<URL[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: URL[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...(await listPageFiles(new URL(`${entry.name}/`, directory))));
    } else if (entry.name === "page.tsx") {
      files.push(new URL(entry.name, directory));
    }
  }
  return files;
}

test("(site) 레이아웃은 세션 게이트 때문에 동적이며 의도를 주석으로 남긴다", async () => {
  const layout = await readFile(new URL("layout.tsx", siteRoot), "utf8");

  assert.match(layout, /export const dynamic = "force-dynamic";/);
  assert.match(layout, /세션 게이트/);
});

test("(site) 페이지는 레이아웃 동적 렌더링으로 효과가 없는 ISR 선언을 두지 않는다", async () => {
  const pages = await listPageFiles(siteRoot);
  assert.ok(pages.length > 10);

  for (const page of pages) {
    const source = await readFile(page, "utf8");
    const label = page.pathname.split("/src/app/")[1];
    assert.doesNotMatch(source, /export const revalidate\s*=/, label);
    assert.doesNotMatch(source, /export (?:async )?function generateStaticParams/, label);
  }
});
