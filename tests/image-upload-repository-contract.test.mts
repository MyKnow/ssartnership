import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

test("이미지 업로드 만료 정리는 bounded concurrency로 처리한다", () => {
  const source = readRepoFile("src/lib/image-upload/repository.supabase.ts");

  assert.match(
    source,
    /import \{ forEachWithConcurrency \} from "@\/lib\/async-concurrency";/,
  );
  assert.match(source, /const EXPIRE_STALE_CONCURRENCY = 4;/);
  assert.match(
    source,
    /await forEachWithConcurrency\(\s*sessions,\s*EXPIRE_STALE_CONCURRENCY,\s*async \(session\) => \{/,
  );
  assert.doesNotMatch(
    source,
    /for \(const session of sessions\) \{/,
  );
});
