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
