import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const MIGRATION = "20261005030746_harden_privileges_retention_and_lifecycle.sql";
const BUCKET_LIMIT_BYTES = 10 * 1024 * 1024;

async function read(path: string) {
  return readFile(new URL(path, root), "utf8");
}

test("공개 미디어 버킷은 WebP와 크기 상한을 Storage에서도 강제한다", async () => {
  const migration = await read(`supabase/migrations/${MIGRATION}`);
  assert.match(
    migration,
    /update storage\.buckets\s+set file_size_limit = 10485760,\s+allowed_mime_types = array\['image\/webp'\]::text\[\]\s+where id in \('partner-media', 'review-media', 'promotion-slides'\);/u,
  );
  assert.match(migration, /if pg_catalog\.to_regclass\('storage\.buckets'\) is not null then/u);
});

test("세 버킷의 모든 쓰기 경로는 서버 정규화 WebP이고 정책 출력이 상한 안에 있다", async () => {
  const { IMAGE_TRANSFORM_POLICIES } = await import("../src/lib/image-upload/policy.ts");
  for (const policy of Object.values(IMAGE_TRANSFORM_POLICIES)) {
    if (["partner", "partner-registration", "partner-change-request", "review", "promotion"].includes(policy.purpose)) {
      assert.ok(policy.maxOutputBytes <= BUCKET_LIMIT_BYTES, `${policy.key} fits the bucket limit`);
    }
  }
  const [repository, partnerMedia, reviewMedia, promotionActions] = await Promise.all([
    read("src/lib/image-upload/repository.supabase.ts"),
    read("src/lib/partner-media-storage.ts"),
    read("src/lib/review-media-storage.ts"),
    read("src/app/admin/(protected)/_actions/promotion-actions.ts"),
  ]);
  assert.match(repository, /\.from\(input\.destination\.bucket\)\s+\.upload\(input\.destination\.path, stagedBuffer, \{\s+contentType: "image\/webp",/u);
  assert.match(partnerMedia, /-\$\{uploadId\}\.webp`/u);
  assert.match(reviewMedia, /-\$\{uploadId\}\.webp`/u);
  assert.match(promotionActions, /path: `promotions\/\$\{slide\.id\}-\$\{slide\.uploadId\}\.webp`/u);
});

test("회원 보안 로그 페이지와 캠퍼스 카탈로그 필터에 맞는 인덱스를 둔다", async () => {
  const [migration, memberDetail, partnerRepository] = await Promise.all([
    read(`supabase/migrations/${MIGRATION}`),
    read("src/lib/admin-member-detail.server.ts"),
    read("src/lib/repositories/supabase/partner-repository.supabase.ts"),
  ]);
  assert.match(
    migration,
    /create index if not exists auth_security_logs_actor_created_at_idx\s+on public\.auth_security_logs \(actor_type, actor_id, created_at desc\)\s+where actor_id is not null;/u,
  );
  assert.match(memberDetail, /\.eq\("actor_type", "member"\)\s+\.eq\("actor_id", memberId\)\s+\.order\("created_at", \{ ascending: false \}\)\s+\.range\(/u);
  assert.match(migration, /create index if not exists partners_campus_slugs_idx\s+on public\.partners using gin \(campus_slugs\);/u);
  assert.match(partnerRepository, /\.contains\("campus_slugs", \[campusSlug\]\)/u);
});
