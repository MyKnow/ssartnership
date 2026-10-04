import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PARTNER_COMPANY_SELECT,
  buildNewPartnerAccountInsert,
  normalizePartnerCompanyRow,
} from "../src/lib/partner-admin/company-account-rows.ts";

const root = new URL("..", import.meta.url);

test("신규 파트너 계정 insert는 비밀번호 변경 필수와 빈 초기 설정 상태로 시작한다", () => {
  const row = buildNewPartnerAccountInsert({
    loginId: "owner@example.com",
    displayName: "담당자",
    isActive: false,
    now: "2026-10-05T00:00:00.000Z",
    passwordRecord: { hash: "hash", salt: "salt" },
  });

  assert.deepEqual(row, {
    login_id: "owner@example.com",
    display_name: "담당자",
    email: "owner@example.com",
    password_hash: "hash",
    password_salt: "salt",
    must_change_password: true,
    is_active: false,
    email_verified_at: null,
    initial_setup_completed_at: null,
    initial_setup_link_sent_at: null,
    initial_setup_expires_at: null,
    created_at: "2026-10-05T00:00:00.000Z",
    updated_at: "2026-10-05T00:00:00.000Z",
  });
});

test("신규 파트너 계정 insert는 비밀번호 기록이 없으면 버려지는 임시 비밀번호 해시를 만든다", () => {
  const first = buildNewPartnerAccountInsert({
    loginId: "owner@example.com",
    displayName: "담당자",
    isActive: true,
    now: "2026-10-05T00:00:00.000Z",
  });
  const second = buildNewPartnerAccountInsert({
    loginId: "owner@example.com",
    displayName: "담당자",
    isActive: true,
    now: "2026-10-05T00:00:00.000Z",
  });

  assert.ok(first.password_hash.length > 0);
  assert.ok(first.password_salt.length > 0);
  assert.notEqual(first.password_salt, second.password_salt);
  assert.equal(first.must_change_password, true);
});

test("파트너사 행 정규화는 누락 값을 운영 기본값으로 채운다", () => {
  assert.equal(normalizePartnerCompanyRow(null), null);
  assert.deepEqual(
    normalizePartnerCompanyRow({ id: "company-1", name: "싸피", slug: "ssafy" }),
    {
      id: "company-1",
      name: "싸피",
      slug: "ssafy",
      description: null,
      is_active: true,
      managed_campus_slugs: [],
    },
  );
  assert.equal(
    PARTNER_COMPANY_SELECT,
    "id,name,slug,description,is_active,managed_campus_slugs",
  );
});

test("관리자 파트너사·계정 쓰기 경로는 공용 행 계약을 재사용한다", async () => {
  const [catalog, provision, accountCreate, supportShared] = await Promise.all([
    readFile(new URL("src/app/admin/(protected)/_actions/catalog-actions.ts", root), "utf8"),
    readFile(
      new URL("src/app/admin/(protected)/_actions/partner-support/company-provision.ts", root),
      "utf8",
    ),
    readFile(
      new URL("src/app/admin/(protected)/_actions/account-actions.account.ts", root),
      "utf8",
    ),
    readFile(new URL("src/app/admin/(protected)/_actions/partner-support/shared.ts", root), "utf8"),
  ]);

  assert.doesNotMatch(catalog, /function normalizePartnerCompanyRow/);
  assert.doesNotMatch(supportShared, /function normalizePartnerCompanyRow/);
  for (const source of [catalog, provision]) {
    assert.match(source, /PARTNER_COMPANY_SELECT/);
    assert.doesNotMatch(source, /"id,name,slug,description,is_active,managed_campus_slugs"/);
  }
  for (const source of [provision, accountCreate]) {
    assert.match(source, /buildNewPartnerAccountInsert\(/);
    assert.doesNotMatch(source, /generateTempPassword/);
  }
});
