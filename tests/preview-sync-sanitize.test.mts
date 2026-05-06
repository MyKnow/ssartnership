import assert from "node:assert/strict";
import test from "node:test";

type PreviewSyncLibModule =
  typeof import("../scripts/supabase-sync-preview-lib.mjs");

const previewSyncLibPromise = import(
  new URL("../scripts/supabase-sync-preview-lib.mjs", import.meta.url).href,
) as Promise<PreviewSyncLibModule>;

test("sanitizeDumpSqlForPreview removes columns absent from preview copy blocks", async () => {
  const { sanitizeDumpSqlForPreview } = await previewSyncLibPromise;

  const sourceSql = [
    'COPY public.partner_companies (id, name, slug, description, contact_name, contact_email, contact_phone, is_active) FROM stdin;',
    "1\tCafe\tcafe\tdesc\tKim\tkim@example.com\t010-1111-2222\tt",
    "\\.",
  ].join("\n");

  const previewColumnsByTable = new Map([
    [
      "partner_companies",
      new Set(["id", "name", "slug", "description", "is_active"]),
    ],
  ]);

  const sanitized = sanitizeDumpSqlForPreview(sourceSql, previewColumnsByTable);

  assert.equal(sanitized.changed, true);
  assert.equal(
    sanitized.sql,
    [
      'COPY "public"."partner_companies" ("id", "name", "slug", "description", "is_active") FROM stdin;',
      "1\tCafe\tcafe\tdesc\tt",
      "\\.",
    ].join("\n"),
  );
});

test("sanitizeDumpSqlForPreview leaves aligned copy blocks unchanged", async () => {
  const { sanitizeDumpSqlForPreview } = await previewSyncLibPromise;

  const sourceSql = [
    'COPY public.categories (id, key, label) FROM stdin;',
    "1\tcafe\t카페",
    "\\.",
  ].join("\n");

  const previewColumnsByTable = new Map([
    ["categories", new Set(["id", "key", "label"])],
  ]);

  const sanitized = sanitizeDumpSqlForPreview(sourceSql, previewColumnsByTable);

  assert.equal(sanitized.changed, false);
  assert.equal(sanitized.sql, sourceSql);
});

test("sanitizeDumpSqlForPreview strips heavy and sensitive member columns", async () => {
  const { sanitizeDumpSqlForPreview } = await previewSyncLibPromise;

  const sourceSql = [
    "COPY public.members (id, mm_username, display_name, avatar_content_type, avatar_base64, password_hash, password_salt, created_at) FROM stdin;",
    "member-1\tssafy15\t김싸피\timage/png\tBASE64_DATA\thash\tsalt\t2026-04-27T00:00:00.000Z",
    "\\.",
  ].join("\n");

  const previewColumnsByTable = new Map([
    [
      "members",
      new Set([
        "id",
        "mm_username",
        "display_name",
        "avatar_content_type",
        "avatar_base64",
        "password_hash",
        "password_salt",
        "created_at",
      ]),
    ],
  ]);

  const sanitized = sanitizeDumpSqlForPreview(sourceSql, previewColumnsByTable);

  assert.equal(sanitized.changed, true);
  assert.equal(
    sanitized.sql,
    [
      'COPY "public"."members" ("id", "mm_username", "display_name", "avatar_content_type", "created_at") FROM stdin;',
      "member-1\tssafy15\t김싸피\timage/png\t2026-04-27T00:00:00.000Z",
      "\\.",
    ].join("\n"),
  );
  assert.equal(sanitized.sql.includes("BASE64_DATA"), false);
  assert.equal(sanitized.sql.includes("hash"), false);
  assert.equal(sanitized.sql.includes("salt"), false);
});

test("sanitizeDumpSqlForPreview backfills empty partner campus slugs", async () => {
  const { sanitizeDumpSqlForPreview } = await previewSyncLibPromise;

  const sourceSql = [
    "COPY public.partners (id, category_id, name, location, campus_slugs, created_at) FROM stdin;",
    "partner-1\tcategory-1\t역삼 카페\t서울 강남구 논현로 508 1층\t{}\t2026-04-27T00:00:00.000Z",
    "partner-2\tcategory-1\t전국 병원\t등록된 병원 전 지점\t\\N\t2026-04-27T00:00:00.000Z",
    "partner-3\tcategory-1\t구미 카페\t경북 구미시\t{gumi}\t2026-04-27T00:00:00.000Z",
    "\\.",
  ].join("\n");

  const previewColumnsByTable = new Map([
    [
      "partners",
      new Set(["id", "category_id", "name", "location", "campus_slugs", "created_at"]),
    ],
  ]);

  const sanitized = sanitizeDumpSqlForPreview(sourceSql, previewColumnsByTable);

  assert.equal(sanitized.changed, true);
  assert.equal(
    sanitized.sql,
    [
      "COPY public.partners (id, category_id, name, location, campus_slugs, created_at) FROM stdin;",
      "partner-1\tcategory-1\t역삼 카페\t서울 강남구 논현로 508 1층\t{seoul}\t2026-04-27T00:00:00.000Z",
      "partner-2\tcategory-1\t전국 병원\t등록된 병원 전 지점\t{seoul,gumi,daejeon,busan-ulsan-gyeongnam,gwangju}\t2026-04-27T00:00:00.000Z",
      "partner-3\tcategory-1\t구미 카페\t경북 구미시\t{gumi}\t2026-04-27T00:00:00.000Z",
      "\\.",
    ].join("\n"),
  );
});
