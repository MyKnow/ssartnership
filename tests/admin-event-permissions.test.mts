import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("이벤트 목록·상세는 조회·생성·수정·삭제 권한에 맞춰 작업을 노출한다", async () => {
  const [listPage, detailPage, listView, detailView] = await Promise.all([
    read("src/app/admin/(protected)/event/page.tsx"),
    read("src/app/admin/(protected)/event/[slug]/page.tsx"),
    read("src/components/admin/AdminEventListView.tsx"),
    read("src/components/admin/AdminEventDetailView.tsx"),
  ]);

  assert.match(
    listPage,
    /canAdmin\(\s*session\.account\.permissions,\s*"events",\s*"create"/,
  );
  assert.match(
    listPage,
    /canAdmin\(\s*session\.account\.permissions,\s*"events",\s*"update"/,
  );
  assert.match(listPage, /canCreate=\{canCreate\}/);
  assert.match(listPage, /canUpdate=\{canUpdate\}/);
  assert.match(
    detailPage,
    /canAdmin\(\s*session\.account\.permissions,\s*"events",\s*"delete"/,
  );
  assert.match(detailPage, /canCreate=\{canCreate\}/);
  assert.match(detailPage, /canUpdate=\{canUpdate\}/);
  assert.match(detailPage, /canDelete=\{canDelete\}/);
  assert.match(listView, /canCreate = true/);
  assert.match(listView, /canUpdate = true/);
  assert.match(detailView, /canCreate = true/);
  assert.match(detailView, /canUpdate = true/);
  assert.match(detailView, /canDelete = true/);
  assert.match(detailView, /조회 전용 권한/);
  assert.match(detailPage, /admin_event_create_failed/);
  assert.match(detailPage, /admin_event_update_failed/);
  assert.match(detailPage, /admin_event_delete_failed/);
  assert.match(detailView, /errorMessage/);
});
