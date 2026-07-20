import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { normalizeMattermostProfileImage } from "../src/lib/graduate-verification-files.ts";
import { resolveImageTransformPolicy } from "../src/lib/image-upload/policy.ts";
import {
  SupabaseImageUploadRepository,
} from "../src/lib/image-upload/repository.supabase.ts";
import { IMAGE_UPLOAD_STAGING_BUCKET } from "../src/lib/image-upload/repository.ts";

type ImageUploadSession = {
  id: string;
  owner_kind: string;
  owner_id: string;
  purpose: "member-signup-profile";
  role: "profile";
  storage_bucket: string;
  storage_path: string;
  source_content_type: string | null;
  source_size_bytes: number | null;
  content_type: string | null;
  sha256: string | null;
  width: number | null;
  height: number | null;
  final_bucket: string | null;
  final_path: string | null;
  final_url: string | null;
  status: "signed" | "processing" | "ready" | "attaching" | "attached" | "failed";
  signed_url_expires_at: string;
  expires_at: string;
  attached_resource_type: string | null;
  attached_resource_id: string | null;
  failure_code: string | null;
};

type Filter = {
  field: string;
  operator: "eq" | "in";
  value: string | string[];
};

function cloneSession(session: ImageUploadSession) {
  return { ...session };
}

function createFakeSupabase(input: {
  session: ImageUploadSession;
  initialStagingBuffer: Buffer;
}) {
  let session = cloneSession(input.session);
  let stagingBuffer = Buffer.from(input.initialStagingBuffer);
  let finalBuffer: Buffer | null = null;
  let stagingDownloadCount = 0;
  let stagingRemoved = false;

  function matches(filters: Filter[]) {
    return filters.every((filter) => {
      const value = session[filter.field as keyof ImageUploadSession];
      if (filter.operator === "eq") {
        return value === filter.value;
      }
      return Array.isArray(filter.value) && filter.value.includes(String(value));
    });
  }

  function executeQuery(
    table: string,
    operation: "select" | "update",
    updates: Partial<ImageUploadSession> | null,
    filters: Filter[],
    selected: string | null,
    single: boolean,
  ) {
    if (table !== "image_upload_sessions") {
      throw new Error(`unexpected table: ${table}`);
    }

    if (operation === "update") {
      if (!matches(filters)) {
        return { data: null, error: null };
      }
      session = { ...session, ...(updates ?? {}) };
      const row = selected === "id" ? { id: session.id } : cloneSession(session);
      return { data: single ? row : [row], error: null };
    }

    if (!matches(filters)) {
      return { data: single ? null : [], error: null };
    }
    const row = selected === "id" ? { id: session.id } : cloneSession(session);
    return { data: single ? row : [row], error: null };
  }

  function queryBuilder(table: string) {
    let operation: "select" | "update" = "select";
    let updates: Partial<ImageUploadSession> | null = null;
    let filters: Filter[] = [];
    let selected: string | null = null;

    const builder = {
      select(columns: string) {
        selected = columns;
        return builder;
      },
      update(values: Partial<ImageUploadSession>) {
        operation = "update";
        updates = values;
        return builder;
      },
      eq(field: string, value: string) {
        filters = [...filters, { field, operator: "eq", value }];
        return builder;
      },
      in(field: string, values: string[]) {
        filters = [...filters, { field, operator: "in", value: values }];
        return builder;
      },
      maybeSingle() {
        return Promise.resolve(executeQuery(table, operation, updates, filters, selected, true));
      },
      then<TResult1 = unknown, TResult2 = never>(
        onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ) {
        return Promise.resolve(executeQuery(table, operation, updates, filters, selected, false))
          .then(onfulfilled, onrejected);
      },
    };

    return builder;
  }

  const storage = {
    from(bucket: string) {
      return {
        async download(path: string) {
          if (bucket !== IMAGE_UPLOAD_STAGING_BUCKET || path !== session.storage_path) {
            return { data: null, error: new Error("unexpected download") };
          }
          stagingDownloadCount += 1;
          // The first attach read sees the old object after complete overwrites the
          // same staging path. The repository must retry until the new bytes settle.
          const buffer = stagingDownloadCount === 2 ? input.initialStagingBuffer : stagingBuffer;
          const arrayBuffer = buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength,
          ) as ArrayBuffer;
          return { data: new Blob([arrayBuffer]), error: null };
        },
        async upload(path: string, body: Buffer) {
          if (bucket === IMAGE_UPLOAD_STAGING_BUCKET && path === session.storage_path) {
            stagingBuffer = Buffer.from(body);
            return { data: { path }, error: null };
          }
          finalBuffer = Buffer.from(body);
          return { data: { path }, error: null };
        },
        async remove(paths: string[]) {
          if (bucket === IMAGE_UPLOAD_STAGING_BUCKET && paths.includes(session.storage_path)) {
            stagingRemoved = true;
          }
          return { data: paths, error: null };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `https://storage.test/${bucket}/${path}` } };
        },
      };
    },
  };

  return {
    from: queryBuilder,
    storage,
    getState() {
      return {
        session: cloneSession(session),
        stagingBuffer: Buffer.from(stagingBuffer),
        finalBuffer: finalBuffer ? Buffer.from(finalBuffer) : null,
        stagingDownloadCount,
        stagingRemoved,
      };
    },
  };
}

test("Mattermost WebP가 complete 이후 같은 Staging 경로에서 지연되어도 signup attach가 재시도한다", async () => {
  const uploadId = "11111111-1111-4111-8111-111111111111";
  const ownerId = "22222222-2222-4222-8222-222222222222";
  const memberId = "33333333-3333-4333-8333-333333333333";
  const now = new Date("2026-07-20T10:00:00.000Z");
  const source = await sharp({
    create: {
      width: 96,
      height: 72,
      channels: 3,
      background: { r: 40, g: 140, b: 160 },
    },
  }).png().toBuffer();
  const normalizedMattermost = await normalizeMattermostProfileImage({
    contentType: "image/png",
    source,
  });
  const fakeSupabase = createFakeSupabase({
    initialStagingBuffer: normalizedMattermost.buffer,
    session: {
      id: uploadId,
      owner_kind: "signup",
      owner_id: ownerId,
      purpose: "member-signup-profile",
      role: "profile",
      storage_bucket: IMAGE_UPLOAD_STAGING_BUCKET,
      storage_path: `staging/${uploadId}.webp`,
      source_content_type: "image/webp",
      source_size_bytes: normalizedMattermost.buffer.length,
      content_type: null,
      sha256: null,
      width: null,
      height: null,
      final_bucket: null,
      final_path: null,
      final_url: null,
      status: "signed",
      signed_url_expires_at: "2026-07-20T10:10:00.000Z",
      expires_at: "2026-07-20T12:00:00.000Z",
      attached_resource_type: null,
      attached_resource_id: null,
      failure_code: null,
    },
  });
  const repository = new SupabaseImageUploadRepository(fakeSupabase as never);
  const policy = resolveImageTransformPolicy("member-signup-profile", "profile");

  const [completed] = await repository.complete({
    actor: { kind: "signup", id: ownerId },
    purpose: "member-signup-profile",
    uploadIds: [uploadId],
    now,
  });
  const attached = await repository.attach({
    actor: { kind: "signup", id: ownerId },
    purpose: "member-signup-profile",
    uploadId,
    role: "profile",
    policy,
    destination: {
      bucket: "member-profile-images",
      path: `members/${memberId}/signup/${uploadId}.webp`,
      isPublic: false,
      cacheControl: "private, no-store",
    },
    resource: { type: "member_signup", id: memberId },
    now,
  });

  const state = fakeSupabase.getState();
  assert.equal(completed?.status, "ready");
  assert.equal(completed?.width, 640);
  assert.equal(completed?.height, 640);
  assert.equal(attached.width, 640);
  assert.equal(attached.height, 640);
  assert.equal(attached.sha256.length, 64);
  assert.equal(state.session.status, "attached");
  assert.equal(state.stagingRemoved, true);
  assert.equal(state.stagingDownloadCount, 3);
  assert.ok(state.finalBuffer);
});
