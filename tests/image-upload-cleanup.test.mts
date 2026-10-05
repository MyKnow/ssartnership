import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import sharp from "sharp";
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
type Filter = { field: string; operator: "eq" | "in" | "lte"; value: unknown };

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
}) {
  const rows = new Map(input.rows.map((row) => [row.id, { ...row }]));
  const failing = new Set(input.failingRemovePaths ?? []);
  const objects = input.objects ?? new Map<string, Buffer>();
  const removed: string[] = [];
  const downloads: string[] = [];
  const infoCalls: string[] = [];

  function matches(row: Row, filters: Filter[]) {
    return filters.every((filter) => {
      const value = row[filter.field];
      if (filter.operator === "eq") return value === filter.value;
      if (filter.operator === "in") return (filter.value as unknown[]).includes(value);
      return String(value) <= String(filter.value);
    });
  }

  function queryBuilder(table: string) {
    assert.equal(table, "image_upload_sessions");
    let updates: Partial<Row> | null = null;
    let selected: string | null = null;
    const filters: Filter[] = [];
    let limit = Number.POSITIVE_INFINITY;

    const execute = (single: boolean) => {
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
          return { data: paths, error: null };
        },
        async info(path: string) {
          infoCalls.push(`${bucket}/${path}`);
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
      rpc: async () => ({ data: null, error: null }),
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

  const expired = await repositoryFor(fake).expireStale(NOW);

  assert.equal(expired, 1);
  assert.equal(fake.row("a").status, "failed");
  assert.equal(fake.row("a").failure_code, "discard_cleanup_pending");
  assert.equal(fake.row("b").status, "expired");
  assert.deepEqual(fake.removed, [`${IMAGE_UPLOAD_STAGING_BUCKET}/staging/b.jpg`]);

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
  assert.deepEqual(expiredFake.removed, [`${IMAGE_UPLOAD_STAGING_BUCKET}/staging/d.jpg`]);

  const signedUrlFake = createFakeSupabase({
    rows: [sessionRow("e", { signed_url_expires_at: PAST })],
    failingRemovePaths: [`${IMAGE_UPLOAD_STAGING_BUCKET}/staging/e.jpg`],
  });
  await assert.rejects(
    repositoryFor(signedUrlFake).complete({ actor: ACTOR, purpose: "review", uploadIds: ["e"], now: NOW }),
    /URL이 만료/,
  );
  assert.equal(signedUrlFake.row("e").status, "failed");
  assert.equal(signedUrlFake.row("e").failure_code, "discard_cleanup_pending");
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
