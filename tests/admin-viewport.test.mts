import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminViewport,
  parseAdminViewport,
} from "../src/lib/admin-viewport.ts";

test("관리자 성능 계측은 모바일·태블릿·데스크톱 폭을 안전하게 분류한다", () => {
  assert.equal(getAdminViewport(320), "mobile");
  assert.equal(getAdminViewport(767), "mobile");
  assert.equal(getAdminViewport(768), "tablet");
  assert.equal(getAdminViewport(1199), "tablet");
  assert.equal(getAdminViewport(1200), "desktop");
  assert.equal(getAdminViewport(Number.NaN), "mobile");
});

test("관리자 viewport 이벤트는 허용된 값만 보존한다", () => {
  assert.equal(parseAdminViewport("mobile"), "mobile");
  assert.equal(parseAdminViewport("desktop"), "desktop");
  assert.equal(parseAdminViewport("wide"), "unknown");
  assert.equal(parseAdminViewport(null), "unknown");
});
