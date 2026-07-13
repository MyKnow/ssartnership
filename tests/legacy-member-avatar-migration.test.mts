import assert from "node:assert/strict";
import test from "node:test";

const migrationLib = await import(
  new URL(
    "../scripts/legacy-member-avatar-migration-lib.mjs",
    import.meta.url,
  ).href,
);

test("기존 아바타 변환은 dry-run이 기본이고 대상 프로젝트를 명시해야 한다", () => {
  assert.deepEqual(
    migrationLib.parseLegacyMemberAvatarMigrationArgs([
      "--project-ref",
      "uuxzzanpxzvhauzxufuk",
    ]),
    {
      apply: false,
      projectRef: "uuxzzanpxzvhauzxufuk",
      retainLegacy: false,
    },
  );
  assert.deepEqual(
    migrationLib.parseLegacyMemberAvatarMigrationArgs([
      "--project-ref",
      "jlcrhzmiuygqnkwmzfyr",
      "--apply",
    ]),
    {
      apply: true,
      projectRef: "jlcrhzmiuygqnkwmzfyr",
      retainLegacy: false,
    },
  );
  assert.deepEqual(
    migrationLib.parseLegacyMemberAvatarMigrationArgs([
      "--project-ref",
      "jlcrhzmiuygqnkwmzfyr",
      "--apply",
      "--retain-legacy",
    ]),
    {
      apply: true,
      projectRef: "jlcrhzmiuygqnkwmzfyr",
      retainLegacy: true,
    },
  );
  assert.throws(
    () => migrationLib.parseLegacyMemberAvatarMigrationArgs(["--apply"]),
    /project-ref/i,
  );
});

test("기존 base64 아바타는 data URL과 별도 content type을 안전하게 해석한다", () => {
  const source = Buffer.from("avatar-bytes");
  const encoded = source.toString("base64");

  assert.deepEqual(
    migrationLib.decodeLegacyMemberAvatarBase64({
      avatarBase64: `data:image/png;base64,${encoded}`,
      avatarContentType: null,
    }),
    {
      contentType: "image/png",
      source,
    },
  );
  assert.deepEqual(
    migrationLib.decodeLegacyMemberAvatarBase64({
      avatarBase64: encoded,
      avatarContentType: "IMAGE/JPEG; charset=binary",
    }),
    {
      contentType: "image/jpeg",
      source,
    },
  );
  assert.throws(
    () =>
      migrationLib.decodeLegacyMemberAvatarBase64({
        avatarBase64: "not base64!",
        avatarContentType: "image/jpeg",
      }),
    /base64/i,
  );
});

test("기존 아바타 대상과 Storage 경로는 결정적이고 검증 가능하다", () => {
  assert.equal(
    migrationLib.resolveLegacyMemberAvatarKind({
      avatarBase64: "YWJj",
      avatarUrl: "https://example.com/avatar.jpg",
    }),
    "base64",
  );
  assert.equal(
    migrationLib.resolveLegacyMemberAvatarKind({
      avatarBase64: null,
      avatarUrl: "https://example.com/avatar.jpg",
    }),
    "url",
  );
  assert.equal(
    migrationLib.resolveLegacyMemberAvatarKind({
      avatar_base64: "YWJj",
      avatar_url: null,
    }),
    "base64",
  );
  assert.equal(
    migrationLib.resolveLegacyMemberAvatarKind({
      avatarBase64: "  ",
      avatarUrl: "  ",
    }),
    null,
  );
  assert.equal(
    migrationLib.buildMemberProfileImageStoragePath({
      memberId: "0dc70fb0-39c6-44a7-83b4-52f1597d6b58",
      sha256: "a".repeat(64),
    }),
    `members/0dc70fb0-39c6-44a7-83b4-52f1597d6b58/${"a".repeat(64)}.webp`,
  );
  assert.throws(
    () =>
      migrationLib.assertSupabaseProjectRef({
        supabaseUrl: "https://uuxzzanpxzvhauzxufuk.supabase.co",
        projectRef: "jlcrhzmiuygqnkwmzfyr",
      }),
    /일치하지 않습니다/,
  );
});
