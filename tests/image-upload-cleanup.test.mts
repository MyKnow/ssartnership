import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { StorageClient } from "@supabase/storage-js";
import { createClient } from "@supabase/supabase-js";
import { resolveImageTransformPolicy } from "../src/lib/image-upload/policy.ts";
import {
  STAGING_CLEANUP_PENDING_FAILURE_CODE,
  SupabaseImageUploadRepository,
} from "../src/lib/image-upload/repository.supabase.ts";
import {
  IMAGE_UPLOAD_STAGING_BUCKET,
  ImageUploadError,
} from "../src/lib/image-upload/repository.ts";

type Row = Record<string, unknown> & { id: string };
type Filter = { field: string; operator: "eq" | "in" | "lte" | "contains"; value: unknown };

const NOW = new Date("2026-10-05T10:00:00.000Z");
const PAST = "2026-10-05T09:00:00.000Z";
const FUTURE = "2026-10-05T12:00:00.000Z";
const ACTOR = { kind: "member", id: "member-1" } as const;

function sessionRow(id: string, overrides: Partial<Row> = {}): Row {
  return {
    id,
    owner_kind: ACTOR.kind,
    owner_id: ACTOR.id,
    purpose: "review",
    role: "image",
    storage_bucket: IMAGE_UPLOAD_STAGING_BUCKET,
    storage_path: `staging/${id}.jpg`,
    source_storage_path: `staging/${id}.jpg`,
    source_content_type: "image/jpeg",
    source_size_bytes: 1_000,
    quota_size_bytes: 1_000,
    content_type: null,
    sha256: null,
    width: null,
    height: null,
    final_bucket: null,
    final_path: null,
    final_url: null,
    status: "signed",
    signed_url_expires_at: FUTURE,
    expires_at: FUTURE,
    attached_resource_type: null,
    attached_resource_id: null,
    failure_code: null,
    ...overrides,
  };
}

function createFakeSupabase(input: {
  rows: Row[];
  failingRemovePaths?: string[];
  objects?: Map<string, Buffer>;
  infoSupported?: boolean;
  beforeClaim?: (rows: Map<string, Row>) => void;
  denyClaims?: boolean;
  existsError?: { status: number };
  infoError?: { status: number; code: string };
  ackError?: boolean;
  failedUploadAttempts?: number;
  beforeAttachClaim?: (rows: Map<string, Row>) => void;
  beforeUpload?: (bucket: string, path: string) => Promise<void>;
  serverNow?: () => Date;
  reviews?: Row[];
  reviewLookupError?: boolean;
}) {
  const rows = new Map(input.rows.map((row) => [row.id, { ...row }]));
  const failing = new Set(input.failingRemovePaths ?? []);
  const objects = input.objects ?? new Map<string, Buffer>();
  const removed: string[] = [];
  const downloads: string[] = [];
  const infoCalls: string[] = [];
  let uploadAttempts = 0;

  function matches(row: Row, filters: Filter[]) {
    return filters.every((filter) => {
      const value = row[filter.field];
      if (filter.operator === "eq") return value === filter.value;
      if (filter.operator === "in") return (filter.value as unknown[]).includes(value);
      if (filter.operator === "contains") return (filter.value as unknown[]).every((entry) => (value as unknown[]).includes(entry));
      return String(value) <= String(filter.value);
    });
  }

  function queryBuilder(table: string) {
    assert.ok(["image_upload_sessions", "partner_reviews"].includes(table));
    let updates: Partial<Row> | null = null;
    let selected: string | null = null;
    const filters: Filter[] = [];
    let limit = Number.POSITIVE_INFINITY;

    const execute = (single: boolean) => {
      if (table === "partner_reviews") {
        if (input.reviewLookupError) return { data: null, error: new Error("lookup unavailable") };
        const matched = (input.reviews ?? []).filter((row) => matches(row, filters));
        return { data: single ? matched[0] ?? null : matched, error: null };
      }
      if (updates?.status === "attaching") input.beforeAttachClaim?.(rows);
      if (input.ackError && updates?.status === "expired") {
        return { data: null, error: new Error("ack unavailable") };
      }
      const matched = [...rows.values()].filter((row) => matches(row, filters)).slice(0, limit);
      if (updates) {
        for (const row of matched) {
          rows.set(row.id, { ...row, ...updates });
        }
      }
      const result = matched.map((row) => {
        const current = rows.get(row.id)!;
        return selected === "id" ? { id: current.id } : { ...current };
      });
      return { data: single ? (result[0] ?? null) : result, error: null };
    };

    const builder = {
      select(columns: string) {
        selected = columns;
        return builder;
      },
      update(values: Partial<Row>) {
        updates = values;
        return builder;
      },
      eq(field: string, value: unknown) {
        filters.push({ field, operator: "eq", value });
        return builder;
      },
      in(field: string, value: unknown[]) {
        filters.push({ field, operator: "in", value });
        return builder;
      },
      lte(field: string, value: unknown) {
        filters.push({ field, operator: "lte", value });
        return builder;
      },
      contains(field: string, value: unknown[]) {
        filters.push({ field, operator: "contains", value });
        return builder;
      },
      limit(value: number) {
        limit = value;
        return builder;
      },
      maybeSingle() {
        return Promise.resolve(execute(true));
      },
      then<T1 = unknown, T2 = never>(
        onfulfilled?: ((value: unknown) => T1 | PromiseLike<T1>) | null,
        onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
      ) {
        return Promise.resolve(execute(false)).then(onfulfilled, onrejected);
      },
    };
    return builder;
  }

  const storage = {
    from(bucket: string) {
      return {
        async remove(paths: string[]) {
          if (paths.some((path) => failing.has(`${bucket}/${path}`))) {
            return { data: null, error: new Error("storage unavailable") };
          }
          removed.push(...paths.map((path) => `${bucket}/${path}`));
          paths.forEach((path) => objects.delete(`${bucket}/${path}`));
          return { data: paths, error: null };
        },
        async exists(path: string) {
          if (input.existsError) return { data: false, error: input.existsError };
          return objects.has(`${bucket}/${path}`)
            ? { data: true, error: null }
            : { data: false, error: { status: 404 } };
        },
        async info(path: string) {
          infoCalls.push(`${bucket}/${path}`);
          if (input.infoError) return { data: null, error: input.infoError };
          if (input.infoSupported === false) {
            return { data: null, error: new Error("not found") };
          }
          const object = objects.get(`${bucket}/${path}`);
          return object
            ? { data: { name: path, size: object.byteLength }, error: null }
            : { data: null, error: new Error("not found") };
        },
        async download(path: string) {
          downloads.push(`${bucket}/${path}`);
          const object = objects.get(`${bucket}/${path}`);
          return object
            ? { data: new Blob([new Uint8Array(object)]), error: null }
            : { data: null, error: new Error("not found") };
        },
        async upload(path: string, body: Buffer) {
          await input.beforeUpload?.(bucket, path);
          uploadAttempts += 1;
          if (uploadAttempts <= (input.failedUploadAttempts ?? 0)) return { data: null, error: new Error("upload unavailable") };
          objects.set(`${bucket}/${path}`, Buffer.from(body));
          return { data: { path }, error: null };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `https://storage.test/${bucket}/${path}` } };
        },
      };
    },
  };

  return {
    client: {
      from: queryBuilder,
      storage,
      rpc: async (name: string, parameters: Record<string, unknown>) => {
        if (name !== "claim_image_upload_cleanup") return { data: null, error: null };
        input.beforeClaim?.(rows);
        if (input.denyClaims) return { data: [], error: null };
        const serverNow = (input.serverNow?.() ?? NOW).toISOString();
        const claims = [...rows.values()].filter((row) => {
          if (parameters.p_upload_id && row.id !== parameters.p_upload_id) return false;
          if (parameters.p_discard) return row.status !== "expired";
          if (row.status === "attached") return row.purpose === "review" && String(row.expires_at) <= serverNow;
          if (row.status === "expired") return ["review_cleanup_tombstone", "image_cleanup_tombstone"].includes(String(row.failure_code));
          return String(row.expires_at) <= serverNow
            || (row.status === "signed" && String(row.signed_url_expires_at) <= serverNow);
        }).map((row) => {
          const tombstone = ["review_cleanup_tombstone", "image_cleanup_tombstone"].includes(String(row.failure_code));
          const previous_status = tombstone ? "expired" : row.status;
          const cleanup_code = tombstone ? row.failure_code : row.purpose === "review" ? "review_cleanup_pending" : "cleanup_pending";
          const claim_updated_at = serverNow;
          Object.assign(row, { status: "failed", failure_code: cleanup_code, updated_at: claim_updated_at });
          return { ...row, previous_status, cleanup_code, claim_updated_at };
        });
        return { data: claims, error: null };
      },
    },
    row: (id: string) => ({ ...rows.get(id)! }),
    removed,
    downloads,
    infoCalls,
  };
}

function repositoryFor(fake: ReturnType<typeof createFakeSupabase>) {
  return new SupabaseImageUploadRepository(
    fake.client as unknown as ConstructorParameters<typeof SupabaseImageUploadRepository>[0],
  );
}

test("만료 정리는 Storage 삭제가 실패한 세션을 expired로 닫지 않고 재시도 대기로 남긴다", async () => {
  const fake = createFakeSupabase({
    rows: [
      sessionRow("a", { status: "ready", expires_at: PAST }),
      sessionRow("b", { status: "ready", expires_at: PAST }),
    ],
    failingRemovePaths: [`${IMAGE_UPLOAD_STAGING_BUCKET}/staging/a.jpg`],
  });

  await assert.rejects(repositoryFor(fake).expireStale(NOW), /정리/);
  assert.equal(fake.row("a").status, "failed");
  assert.equal(fake.row("a").failure_code, "review_cleanup_pending");
  assert.equal(fake.row("b").status, "expired");
  assert.deepEqual(fake.removed, [`${IMAGE_UPLOAD_STAGING_BUCKET}/staging/b.jpg`, `${IMAGE_UPLOAD_STAGING_BUCKET}/processed/b.webp`]);

  // 다음 주기에는 failed 세션을 다시 집어 지운다.
  const retryFake = createFakeSupabase({ rows: [fake.row("a")] });
  assert.equal(await repositoryFor(retryFake).expireStale(NOW), 1);
  assert.equal(retryFake.row("a").status, "expired");
});

test("연결 뒤 staging 삭제가 실패한 세션은 최종 객체를 두고 staging만 다시 지운다", async () => {
  const fake = createFakeSupabase({
    rows: [
      sessionRow("c", {
        status: "attached",
        storage_path: "processed/c.webp",
        failure_code: STAGING_CLEANUP_PENDING_FAILURE_CODE,
        final_bucket: "review-media",
        final_path: "reviews/p/r/0-c.webp",
      }),
    ],
  });

  assert.equal(await repositoryFor(fake).expireStale(NOW), 0);
  assert.deepEqual(fake.removed.toSorted(), [
    `${IMAGE_UPLOAD_STAGING_BUCKET}/processed/c.webp`,
    `${IMAGE_UPLOAD_STAGING_BUCKET}/staging/c.jpg`,
  ]);
  assert.equal(fake.row("c").status, "attached");
  assert.equal(fake.row("c").failure_code, null);
});

test("complete가 만료 세션을 만나면 staging 객체를 지운 뒤 expired로 닫는다", async () => {
  const expiredFake = createFakeSupabase({ rows: [sessionRow("d", { expires_at: PAST })] });
  await assert.rejects(
    repositoryFor(expiredFake).complete({ actor: ACTOR, purpose: "review", uploadIds: ["d"], now: NOW }),
    /만료/,
  );
  assert.equal(expiredFake.row("d").status, "expired");
  assert.deepEqual(expiredFake.removed, [`${IMAGE_UPLOAD_STAGING_BUCKET}/staging/d.jpg`, `${IMAGE_UPLOAD_STAGING_BUCKET}/processed/d.webp`]);

  const signedUrlFake = createFakeSupabase({
    rows: [sessionRow("e", { signed_url_expires_at: PAST })],
    failingRemovePaths: [`${IMAGE_UPLOAD_STAGING_BUCKET}/staging/e.jpg`],
  });
  await assert.rejects(
    repositoryFor(signedUrlFake).complete({ actor: ACTOR, purpose: "review", uploadIds: ["e"], now: NOW }),
    /URL이 만료/,
  );
  assert.equal(signedUrlFake.row("e").status, "failed");
  assert.equal(signedUrlFake.row("e").failure_code, "review_cleanup_pending");
});

test("complete는 Storage 메타데이터 크기가 선언과 다르면 원본을 내려받지 않고 거부한다", async () => {
  const objects = new Map([[`${IMAGE_UPLOAD_STAGING_BUCKET}/staging/f.jpg`, Buffer.alloc(9_000_000)]]);
  const fake = createFakeSupabase({ rows: [sessionRow("f")], objects });

  await assert.rejects(
    repositoryFor(fake).complete({ actor: ACTOR, purpose: "review", uploadIds: ["f"], now: NOW }),
    (error: unknown) =>
      error instanceof ImageUploadError && error.code === "upload_source_size_mismatch",
  );
  assert.deepEqual(fake.infoCalls, [`${IMAGE_UPLOAD_STAGING_BUCKET}/staging/f.jpg`]);
  assert.deepEqual(fake.downloads, []);
  assert.equal(fake.row("f").status, "failed");
  assert.equal(fake.row("f").failure_code, "source_size_mismatch");
});

test("Storage 메타데이터를 읽지 못하면 기존처럼 내려받은 뒤 크기를 검증한다", async () => {
  const objects = new Map([[`${IMAGE_UPLOAD_STAGING_BUCKET}/staging/g.jpg`, Buffer.alloc(2_000)]]);
  const fake = createFakeSupabase({ rows: [sessionRow("g")], objects, infoSupported: false });

  await assert.rejects(
    repositoryFor(fake).complete({ actor: ACTOR, purpose: "review", uploadIds: ["g"], now: NOW }),
    (error: unknown) =>
      error instanceof ImageUploadError && error.code === "upload_source_size_mismatch",
  );
  assert.deepEqual(fake.downloads, [`${IMAGE_UPLOAD_STAGING_BUCKET}/staging/g.jpg`]);
});

test("attach는 연결을 끝낸 뒤 staging 삭제가 실패하면 연결을 유지하고 재시도 표시만 남긴다", async () => {
  const policy = resolveImageTransformPolicy("review", "image");
  const processed = await sharp({
    create: { width: policy.width, height: policy.height, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .webp({ quality: policy.quality })
    .toBuffer();
  const sha256 = createHash("sha256").update(processed).digest("hex");
  const objects = new Map([[`${IMAGE_UPLOAD_STAGING_BUCKET}/processed/h.webp`, processed]]);
  const fake = createFakeSupabase({
    rows: [
      sessionRow("h", {
        status: "ready",
        storage_path: "processed/h.webp",
        content_type: "image/webp",
        sha256,
        width: policy.width,
        height: policy.height,
      }),
    ],
    objects,
    failingRemovePaths: [`${IMAGE_UPLOAD_STAGING_BUCKET}/processed/h.webp`],
  });

  const attached = await repositoryFor(fake).attach({
    actor: ACTOR,
    purpose: "review",
    uploadId: "h",
    role: "image",
    policy,
    destination: { bucket: "review-media", path: "reviews/p/r/0-h.webp", isPublic: true },
    resource: { type: "partner_review", id: "r" },
    now: NOW,
  });

  assert.equal(attached.url, "https://storage.test/review-media/reviews/p/r/0-h.webp");
  assert.equal(fake.row("h").status, "attached");
  assert.equal(fake.row("h").failure_code, STAGING_CLEANUP_PENDING_FAILURE_CODE);
});

function attachedReviewRow(id: string, overrides: Partial<Row> = {}) {
  const policy = resolveImageTransformPolicy("review", "image");
  return sessionRow(id, {
    status: "attached", storage_path: `processed/${id}.webp`, content_type: "image/webp",
    width: policy.width, height: policy.height, sha256: "a".repeat(64),
    final_bucket: "review-media", final_path: `reviews/p/r/0-${id}.webp`,
    final_url: `https://storage.test/review-media/reviews/p/r/0-${id}.webp`,
    attached_resource_type: "partner_review", attached_resource_id: "r", ...overrides,
  });
}
function attachReview(fake: ReturnType<typeof createFakeSupabase>, id: string) {
  return repositoryFor(fake).attach({
    actor: ACTOR, purpose: "review", role: "image", uploadId: id,
    policy: resolveImageTransformPolicy("review", "image"),
    destination: { bucket: "review-media", path: `reviews/p/r/0-${id}.webp`, isPublic: true },
    resource: { type: "partner_review", id: "r" }, now: NOW,
  });
}
test("attached 리뷰 객체가 없으면 URL을 반환하지 않고 재업로드 오류를 돌려준다", async () => {
  const fake = createFakeSupabase({ rows: [attachedReviewRow("missing")] });
  await assert.rejects(attachReview(fake, "missing"), (error: unknown) =>
    error instanceof ImageUploadError && error.code === "review_image_reupload_required");
  assert.equal(fake.row("missing").status, "attached");
});
test("attached 리뷰 객체 조회의 일시 오류는 재업로드로 오인하지 않는다", async () => {
  for (const status of [400, 500, 503]) {
    const fake = createFakeSupabase({ rows: [attachedReviewRow("unavailable")], existsError: { status } });
    await assert.rejects(attachReview(fake, "unavailable"), (error: unknown) =>
      error instanceof ImageUploadError && error.code === "review_image_lookup_unavailable");
    assert.equal(fake.row("unavailable").status, "attached");
  }
});
test("원자적 정리 권한을 얻지 못하면 stale snapshot의 파일을 지우지 않는다", async () => {
  const fake = createFakeSupabase({
    rows: [attachedReviewRow("claimed-by-writer", { status: "attaching", expires_at: PAST })],
    denyClaims: true,
    beforeClaim: (rows) => { rows.get("claimed-by-writer")!.status = "attached"; },
  });
  assert.equal(await repositoryFor(fake).expireStale(NOW), 0);
  assert.equal(fake.row("claimed-by-writer").status, "attached");
  assert.deepEqual(fake.removed, []);
});
test("미참조 리뷰 만료는 최종 파일을 지우고 늦은 업로드 재검사용 표식을 유지한다", async () => {
  const objects = new Map([["review-media/reviews/p/r/0-orphan.webp", Buffer.from("image")]]);
  const fake = createFakeSupabase({ rows: [attachedReviewRow("orphan", { expires_at: PAST })], objects });
  assert.equal(await repositoryFor(fake).expireStale(NOW), 1);
  assert.equal(fake.row("orphan").status, "expired");
  assert.equal(fake.row("orphan").failure_code, "review_cleanup_tombstone");
  assert.equal(objects.size, 0);
  objects.set("review-media/reviews/p/r/0-orphan.webp", Buffer.from("late-upload"));
  assert.equal(await repositoryFor(fake).expireStale(NOW), 0);
  assert.equal(objects.size, 0);
});
test("삭제 후 상태 저장 실패도 정리 대기 상태를 남겨 다음 주기에서 복구한다", async () => {
  const fake = createFakeSupabase({ rows: [attachedReviewRow("ack", { expires_at: PAST })], ackError: true });
  await assert.rejects(repositoryFor(fake).expireStale(NOW), /정리/);
  assert.equal(fake.row("ack").status, "failed");
  assert.equal(fake.row("ack").failure_code, "review_cleanup_pending");
  const retry = createFakeSupabase({ rows: [fake.row("ack")] });
  assert.equal(await repositoryFor(retry).expireStale(NOW), 1);
});
test("참조 중 세션의 discard는 원자적 권한 거절 뒤 파일을 보존한다", async () => {
  const fake = createFakeSupabase({ rows: [attachedReviewRow("protected")], denyClaims: true });
  await repositoryFor(fake).discard({ actor: ACTOR, purpose: "review", uploadId: "protected", now: NOW });
  assert.deepEqual(fake.removed, []);
  assert.equal(fake.row("protected").status, "attached");
});

test("리뷰 최종 업로드 실패는 원래 만료 전 같은 대상과 정규화 원본으로 재시도할 수 있다", async () => {
  const policy = resolveImageTransformPolicy("review", "image");
  const processed = await sharp({ create: { width: policy.width, height: policy.height, channels: 3, background: "red" } }).webp({ quality: policy.quality }).toBuffer();
  const objects = new Map([["image-upload-staging/processed/retry.webp", processed]]);
  const fake = createFakeSupabase({
    rows: [attachedReviewRow("retry", { status: "ready", sha256: createHash("sha256").update(processed).digest("hex") })],
    objects, failedUploadAttempts: 3,
  });
  await assert.rejects(attachReview(fake, "retry"), /최종 보관소/);
  assert.equal(fake.row("retry").failure_code, "attach_failed");
  const retry = await attachReview(fake, "retry");
  assert.ok(retry.url);
  assert.equal(fake.row("retry").status, "attached");
  assert.ok(objects.has("review-media/reviews/p/r/0-retry.webp"));
  assert.equal(fake.row("retry").expires_at, FUTURE);
});
test("실패 업로드 재시도와 정리 claim이 경합해도 정리 대기 세션을 다시 열지 않는다", async () => {
  const fake = createFakeSupabase({
    rows: [attachedReviewRow("retired", { status: "failed", failure_code: "attach_failed" })],
    beforeAttachClaim: (rows) => { rows.get("retired")!.failure_code = "review_cleanup_pending"; },
  });
  await assert.rejects(attachReview(fake, "retired"));
  assert.equal(fake.row("retired").status, "failed");
  assert.equal(fake.row("retired").failure_code, "review_cleanup_pending");
  assert.deepEqual(fake.downloads, []);
});

test("처리 중 만료 뒤 늦게 업로드된 정규화 파일도 리뷰 삭제 표식이 다시 지운다", async () => {
  const objects = new Map<string, Buffer>();
  const fake = createFakeSupabase({ rows: [sessionRow("late", { status: "processing", expires_at: PAST })], objects });
  assert.equal(await repositoryFor(fake).expireStale(NOW), 1);
  objects.set("image-upload-staging/processed/late.webp", Buffer.from("late normalized"));
  assert.equal(await repositoryFor(fake).expireStale(NOW), 0);
  assert.equal(objects.size, 0);
});

test("Storage HEAD가 400을 반환해도 구체적인 missing-key 응답을 확인하면 재업로드로 안내한다", async () => {
  const fake = createFakeSupabase({
    rows: [attachedReviewRow("legacy-missing")],
    existsError: { status: 400 }, infoError: { status: 400, code: "NoSuchKey" },
  });
  await assert.rejects(attachReview(fake, "legacy-missing"), (error: unknown) =>
    error instanceof ImageUploadError && error.code === "review_image_reupload_required");
});

test("실제 Storage SDK의 NoSuchKey와 권한·제공자 오류를 구분한다", async () => {
  for (const scenario of [
    { head: 400, info: 400, code: "NoSuchKey", expected: "review_image_reupload_required" },
    { head: 404, info: 500, code: "InternalError", expected: "review_image_reupload_required" },
    { head: 400, info: 400, code: "InvalidRequest", expected: "review_image_lookup_unavailable" },
    { head: 403, info: 403, code: "NoSuchKey", expected: "review_image_lookup_unavailable" },
    { head: 400, info: 403, code: "NoSuchKey", expected: "review_image_lookup_unavailable" },
    { head: 400, info: 503, code: "NoSuchKey", expected: "review_image_lookup_unavailable" },
    { head: 503, info: 503, code: "InternalError", expected: "review_image_lookup_unavailable" },
  ]) {
    const fake = createFakeSupabase({ rows: [attachedReviewRow("sdk")] });
    const storage = new StorageClient("https://storage.invalid/storage/v1", {}, async (_url, init) => {
      if (init?.method === "HEAD") return new Response(null, { status: scenario.head });
      return new Response(JSON.stringify({ code: scenario.code, message: "fixture" }), {
        status: scenario.info, headers: { "content-type": "application/json" },
      });
    });
    const repository = new SupabaseImageUploadRepository({ ...fake.client, storage } as unknown as ConstructorParameters<typeof SupabaseImageUploadRepository>[0]);
    await assert.rejects(repository.attach({
      actor: ACTOR, purpose: "review", role: "image", uploadId: "sdk",
      policy: resolveImageTransformPolicy("review", "image"),
      destination: { bucket: "review-media", path: "reviews/p/r/0-sdk.webp", isPublic: true },
      resource: { type: "partner_review", id: "r" }, now: NOW,
    }), (error: unknown) => error instanceof ImageUploadError && error.code === scenario.expected, JSON.stringify(scenario));
  }
});

test("만료된 attached 리뷰는 같은 리뷰가 이미 참조할 때만 재사용한다", async () => {
  const row = attachedReviewRow("expired-reference", { expires_at: PAST });
  const bound = { id: "r", member_id: ACTOR.id, images: [row.final_url] };
  for (const reviews of [[], [{ ...bound, id: "other" }], [{ ...bound, member_id: "other" }], [{ ...bound, images: [] }], [bound]]) {
    const fake = createFakeSupabase({ rows: [row], reviews,
      objects: new Map([[`review-media/${row.final_path}`, Buffer.from("present")]]),
    });
    if (reviews[0] === bound) assert.equal((await attachReview(fake, "expired-reference")).url, row.final_url);
    else await assert.rejects(attachReview(fake, "expired-reference"), (error: unknown) =>
      error instanceof ImageUploadError && error.code === "review_image_reupload_required");
    assert.deepEqual(fake.removed, []);
    assert.equal(fake.row("expired-reference").status, "attached");
  }
});

test("만료된 리뷰의 참조 조회 장애는 새 업로드 필요로 오인하지 않는다", async () => {
  const row = attachedReviewRow("reference-outage", { expires_at: PAST });
  const fake = createFakeSupabase({ rows: [row], reviewLookupError: true,
    objects: new Map([[`review-media/${row.final_path}`, Buffer.from("present")]]),
  });
  await assert.rejects(attachReview(fake, "reference-outage"), (error: unknown) =>
    error instanceof ImageUploadError && error.code === "review_image_lookup_unavailable");
  assert.deepEqual(fake.removed, []);
});

for (const scenario of [
  { name: "404 빈 배열", status: 404, data: [] },
  { name: "다른 리뷰 ID", status: 200, data: [{ id: "other" }] },
  { name: "ID 없는 객체", status: 200, data: [{}] },
]) {
  test(`실제 PostgREST SDK의 ${scenario.name} 응답은 만료 첨부의 참조 증거가 아니다`, async () => {
    const row = attachedReviewRow("invalid-receipt", { expires_at: PAST });
    const client = createClient("https://fixture.invalid", "synthetic-key", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("image_upload_sessions")) return Response.json([row]);
        if (url.pathname.endsWith("partner_reviews")) return Response.json(scenario.data, { status: scenario.status });
        if (init?.method === "HEAD") return new Response(null, { status: 200 });
        throw new Error("Unexpected fixture request");
      } },
    });
    await assert.rejects(new SupabaseImageUploadRepository(client).attach({
      actor: ACTOR, purpose: "review", role: "image", uploadId: "invalid-receipt",
      policy: resolveImageTransformPolicy("review", "image"),
      destination: { bucket: "review-media", path: "reviews/p/r/0-invalid-receipt.webp", isPublic: true },
      resource: { type: "partner_review", id: "r" }, now: NOW,
    }), (error: unknown) => error instanceof ImageUploadError && error.code === "review_image_reupload_required");
  });
}

test("실패 후 이미지 순서가 달라져 기존 연결 경로를 재사용할 수 없으면 재업로드를 안내한다", async () => {
  const fake = createFakeSupabase({ rows: [attachedReviewRow("moved", { final_path: "reviews/p/r/1-moved.webp" })] });
  await assert.rejects(attachReview(fake, "moved"), (error: unknown) =>
    error instanceof ImageUploadError && error.code === "review_image_reupload_required");
  assert.deepEqual(fake.removed, []);
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}
async function preparedProfile(id: string) {
  const policy = resolveImageTransformPolicy("profile", "profile");
  const processed = await sharp({ create: { width: policy.width, height: policy.height, channels: 3, background: "blue" } }).webp({ quality: policy.quality }).toBuffer();
  const row = sessionRow(id, {
    purpose: "profile", role: "profile", status: "ready", content_type: "image/webp",
    storage_path: `processed/${id}.webp`, sha256: createHash("sha256").update(processed).digest("hex"),
    width: policy.width, height: policy.height,
  });
  const request = {
    actor: ACTOR, purpose: "profile" as const, role: "profile", uploadId: id, policy,
    destination: { bucket: "member-profile-images", path: `profiles/${id}.webp`, isPublic: false },
    resource: { type: "member", id: "member-1" }, now: NOW,
  };
  return { row, request, processed };
}
test("비리뷰 연결 중 만료 후 Storage가 늦게 완료돼도 만료 상태를 유지하고 다음 순회에서 파일을 지운다", async () => {
  const { row, request, processed } = await preparedProfile("late-profile");
  const dispatched = deferred(); const completeUpload = deferred();
  let serverTime = NOW;
  const objects = new Map([["image-upload-staging/processed/late-profile.webp", processed]]);
  const fake = createFakeSupabase({ rows: [row], objects, serverNow: () => serverTime,
    beforeUpload: async () => { dispatched.resolve(); await completeUpload.promise; },
  });
  const attaching = repositoryFor(fake).attach(request);
  await dispatched.promise;
  serverTime = new Date("2026-10-05T13:00:00.000Z");
  assert.equal(await repositoryFor(fake).expireStale(serverTime), 1);
  assert.equal(fake.row("late-profile").status, "expired");
  const failedAttach = assert.rejects(attaching, /이미지 연결 상태/);
  completeUpload.resolve(); await failedAttach;
  assert.ok(objects.has("member-profile-images/profiles/late-profile.webp"));
  assert.equal(fake.row("late-profile").failure_code, "image_cleanup_tombstone");
  serverTime = new Date("2026-10-05T14:00:00.000Z");
  assert.equal(await repositoryFor(fake).expireStale(serverTime), 0);
  assert.equal(objects.size, 0);
});
test("Storage 업로드 timeout 뒤 외부 쓰기만 늦게 완료되어도 비리뷰 삭제 표식이 재정리한다", async () => {
  const { row, request, processed } = await preparedProfile("timeout-profile");
  let serverTime = NOW;
  const objects = new Map([["image-upload-staging/processed/timeout-profile.webp", processed]]);
  const fake = createFakeSupabase({ rows: [row], objects, serverNow: () => serverTime,
    beforeUpload: async () => { throw new DOMException("Provider response deadline", "TimeoutError"); },
  });
  await assert.rejects(repositoryFor(fake).attach(request), /Provider response deadline/);
  serverTime = new Date("2026-10-05T13:00:00.000Z");
  assert.equal(await repositoryFor(fake).expireStale(serverTime), 1);
  // The failed HTTP response did not cancel the provider's independent write.
  objects.set("member-profile-images/profiles/timeout-profile.webp", processed);
  serverTime = new Date("2026-10-05T14:00:00.000Z");
  assert.equal(await repositoryFor(fake).expireStale(serverTime), 0);
  assert.equal(objects.size, 0);
});
test("정상 연결된 비리뷰 세션은 만료 시각이 지나도 원래 보유 정책을 유지한다", async () => {
  const objects = new Map([["member-profile-images/profiles/attached.webp", Buffer.from("keep")]]);
  const fake = createFakeSupabase({ rows: [attachedReviewRow("attached", { purpose: "profile", expires_at: PAST,
    final_bucket: "member-profile-images", final_path: "profiles/attached.webp" })], objects });
  assert.equal(await repositoryFor(fake).expireStale(NOW), 0);
  assert.equal(fake.row("attached").status, "attached");
  assert.equal(objects.size, 1);
  assert.deepEqual(fake.removed, []);
});
test("비리뷰 삭제 표식의 재정리 실패가 신규 만료 건수로 다시 집계되지 않는다", async () => {
  const prior = sessionRow("tombstone-retry", { purpose: "profile", status: "expired", expires_at: PAST, failure_code: "image_cleanup_tombstone" });
  const fake = createFakeSupabase({ rows: [prior], failingRemovePaths: ["image-upload-staging/staging/tombstone-retry.jpg"] });
  await assert.rejects(repositoryFor(fake).expireStale(NOW), /정리/);
  assert.equal(fake.row("tombstone-retry").failure_code, "image_cleanup_tombstone");
  const retry = createFakeSupabase({ rows: [fake.row("tombstone-retry")] });
  assert.equal(await repositoryFor(retry).expireStale(NOW), 0);
});
