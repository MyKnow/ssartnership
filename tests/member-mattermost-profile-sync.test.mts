import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { decodeMemberProfileImageData } from "@/lib/member-profile-images";

test("Mattermost data URI는 서버 변환용 바이트와 콘텐츠 타입으로만 해석한다", () => {
  const decoded = decodeMemberProfileImageData(
    "data:image/png;base64,aGVsbG8=",
    null,
  );

  assert.equal(decoded?.contentType, "image/png");
  assert.equal(decoded?.source.toString("utf8"), "hello");
});

test("공통 변환 대상 형식과 손상된 base64를 구분한다", () => {
  assert.equal(
    decodeMemberProfileImageData("data:image/svg+xml;base64,PHN2Zy8+", null)?.contentType,
    "image/svg+xml",
  );
  assert.equal(decodeMemberProfileImageData("not base64", "image/png"), null);
});

test("Mattermost 사진 활성화는 원자 RPC에서 이미지 원장의 review_reason을 정리한다", async () => {
  const [source, repository, migration] = await Promise.all([
    readFile(new URL("../src/lib/member-profile-images.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/repositories/supabase/member-profile-image-records.supabase.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20261006010931_fence_consent_profile_delivery_and_upload_transitions.sql", import.meta.url), "utf8"),
  ]);
  const parsed = ts.createSourceFile("member-profile-images.ts", source, ts.ScriptTarget.Latest, true);
  const activation = parsed.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "activateMemberProfileImage");
  assert.ok(activation?.body);
  const activationBody = activation.body.getText(parsed);
  assert.match(activationBody, /return activateMemberProfileImageRecord\(input\.memberId, input\.nextImageId\)/u);
  assert.doesNotMatch(activationBody, /\.from\(/u);
  assert.match(repository, /\.rpc\(\s*"activate_member_profile_image_atomic",\s*\{ input_member_id: memberId, input_image_id: imageId \}/u);
  const sql = migration.match(/create or replace function public\.activate_member_profile_image_atomic\([\s\S]*?\$\$;/u)?.[0];
  assert.ok(sql);
  assert.match(sql, /set status = 'approved',[\s\S]*review_reason = null/u);
  assert.doesNotMatch(sql, /review_note/u);
});
