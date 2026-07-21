import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("인증 카드 내부 크기는 cqw 기반 clamp로 제한된다", () => {
  const frame = readRepoFile("src/components/certification/CertificationCardFrame.tsx");
  const view = readRepoFile("src/components/certification/CertificationView.tsx");

  assert.match(frame, /clamp\([^)]*cqw/);
  assert.match(frame, /grid-cols-\[minmax\(0,1fr\)_clamp/);
  assert.match(frame, /flex-wrap/);
  assert.match(frame, /min-w-0/);
  assert.match(readRepoFile("src/app/globals.css"), /@container cert \(max-width: 34rem\)/);
  assert.match(view, /line-clamp-1|truncate/);
});

test("인증 카드의 긴 한국어와 footer는 카드 밖으로 넘치지 않도록 제한된다", () => {
  const frame = readRepoFile("src/components/certification/CertificationCardFrame.tsx");
  const verifyPage = readRepoFile("src/app/(site)/verify/[token]/page.tsx");

  assert.match(frame, /max-w-full/);
  assert.match(frame, /max-h-full|overflow-hidden/);
  assert.match(verifyPage, /min-w-0/);
  assert.match(verifyPage, /truncate|overflow-wrap|break-keep/);
});
