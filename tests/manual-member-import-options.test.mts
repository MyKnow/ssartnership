import assert from "node:assert/strict";
import test from "node:test";
import {
  getManualMemberImportGenerationOptions,
  normalizeManualMemberImportCampus,
} from "@/lib/member-manual-import/options";

test("수동 회원 행의 기수 선택지는 운영진부터 현재 기수까지 연속으로 제공한다", () => {
  assert.deepEqual(
    getManualMemberImportGenerationOptions(3),
    [
      { value: "0", label: "운영진" },
      { value: "1", label: "1기" },
      { value: "2", label: "2기" },
      { value: "3", label: "3기" },
    ],
  );
});

test("수동 회원 행의 캠퍼스는 디렉터리 라벨로 정규화한다", () => {
  assert.equal(normalizeManualMemberImportCampus("서울"), "서울");
  assert.equal(normalizeManualMemberImportCampus("서울 캠퍼스"), "서울");
  assert.equal(normalizeManualMemberImportCampus("존재하지 않는 캠퍼스"), null);
});
