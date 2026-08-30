import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("Mattermost sender 상태 확인은 입력 순서를 보존하며 동시성을 제한한다", () => {
  const source = read("../src/app/api/cron/mattermost-sender-health/route.ts");

  assert.match(source, /import \{ forEachWithConcurrency \} from "@\/lib\/async-concurrency"/);
  assert.match(source, /const SENDER_HEALTH_CHECK_CONCURRENCY = 4;/);
  assert.match(
    source,
    /await forEachWithConcurrency\(\s*senders,\s*SENDER_HEALTH_CHECK_CONCURRENCY,\s*async \(sender, index\) => \{/,
  );
  assert.match(source, /results\[index\] = \{ generation: sender\.generation/);
  assert.doesNotMatch(source, /for \(const sender of senders\)/);
});

test("Mattermost 세대별 디렉터리 수집은 입력 순서를 보존하며 동시성을 제한한다", () => {
  const source = read("../src/lib/mm-directory/collector.ts");

  assert.match(source, /import \{ forEachWithConcurrency \} from "@\/lib\/async-concurrency"/);
  assert.match(source, /const GENERATION_COLLECTION_CONCURRENCY = 3;/);
  assert.match(
    source,
    /await forEachWithConcurrency\(\s*activeGenerations,\s*GENERATION_COLLECTION_CONCURRENCY,\s*async \(generation, index\) => \{/,
  );
  assert.match(source, /batches\[index\] = await collectGenerationSnapshots\(generation\)/);
  assert.doesNotMatch(
    source,
    /Promise\.all\(activeGenerations\.map\(collectGenerationSnapshots\)\)/,
  );
});

test("만료 프로모션 정리는 한 번에 100건만 조회하고 내부 오류를 노출하지 않는다", () => {
  const source = read("../src/app/api/cron/archive-expired-promotions/route.ts");

  assert.match(source, /const ARCHIVE_EVENT_BATCH_SIZE = 100;/);
  assert.match(source, /\.limit\(ARCHIVE_EVENT_BATCH_SIZE\)/);
  assert.match(source, /message: ARCHIVE_ERROR_MESSAGE/);
  assert.doesNotMatch(source, /message: \w+Error\.message/);
});

test("이미지 정규화와 수동 회원 사진 준비는 공용 제한 동시성 매퍼를 사용한다", () => {
  const imageRepository = read("../src/lib/image-upload/repository.supabase.ts");
  const manualImport = read("../src/lib/member-manual-import/service.server.ts");

  assert.match(imageRepository, /const COMPLETE_UPLOAD_CONCURRENCY = 4;/);
  assert.match(
    imageRepository,
    /mapWithConcurrency\(\s*uploadIds,\s*COMPLETE_UPLOAD_CONCURRENCY,/,
  );
  assert.match(
    manualImport,
    /const MANUAL_IMPORT_IMAGE_PREPARE_CONCURRENCY = 4;/,
  );
  assert.match(
    manualImport,
    /mapWithConcurrency\(\s*rowsResult\.acceptedRows,\s*MANUAL_IMPORT_IMAGE_PREPARE_CONCURRENCY,/,
  );
  assert.doesNotMatch(
    manualImport,
    /Promise\.all\(rowsResult\.acceptedRows\.map/,
  );
});
