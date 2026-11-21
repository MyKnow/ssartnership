import assert from "node:assert/strict";
import test from "node:test";
import {
  filterAndSortRecipientOptions,
  filterEligibleRecipients,
  formatRecipientMeta,
} from "../src/components/admin/push-manager/recipient-members.ts";
import type { MemberOption } from "../src/components/admin/push-manager/types.ts";

const members: MemberOption[] = [
  { id: "missing", display_name: null, mm_username: "unknown", year: null, campus: null },
  { id: "staff", display_name: "가운영", mm_username: "ops", year: 0, campus: "서울" },
  { id: "older", display_name: "나동문", mm_username: "alumni", year: 14, campus: "대전" },
  { id: "current", display_name: "다싸피", mm_username: "student", year: 15, campus: "서울" },
  { id: "tie", display_name: "라싸피", mm_username: "student2", year: 15, campus: "서울" },
];
const label = (member: MemberOption) => `${member.display_name ?? member.mm_username} (@${member.mm_username})`;
const ids = (items: MemberOption[]) => items.map((member) => member.id);

test("개인 대상 정렬은 기수 내림차순과 캠퍼스·이름 동률 순서를 보존하고 입력을 바꾸지 않는다", () => {
  const original = [...members];
  assert.deepEqual(ids(filterAndSortRecipientOptions(members, "", "year", label)), ["current", "tie", "older", "staff", "missing"]);
  assert.deepEqual(ids(filterAndSortRecipientOptions(members, "", "campus", label)), ["older", "current", "tie", "staff", "missing"]);
  assert.deepEqual(ids(filterAndSortRecipientOptions(members, "", "name", label)), ["staff", "older", "current", "tie", "missing"]);
  assert.deepEqual(members, original);
});

test("개인 검색은 이름·아이디·기수·캠퍼스와 전달된 표시 라벨을 공백 및 대소문자 정규화 후 비교한다", () => {
  assert.deepEqual(ids(filterAndSortRecipientOptions(members, "  STUDENT  ", "name", label)), ["current", "tie"]);
  assert.deepEqual(ids(filterAndSortRecipientOptions(members, "14", "name", label)), ["older"]);
  assert.deepEqual(ids(filterAndSortRecipientOptions(members, "대전", "name", label)), ["older"]);
  assert.deepEqual(ids(filterAndSortRecipientOptions(members, "가운영", "name", label)), ["staff"]);
  assert.equal(filterAndSortRecipientOptions(members, "표시 라벨", "name", () => "표시 라벨").length, 5);
  assert.deepEqual(filterAndSortRecipientOptions(members, "없는 회원", "name", label), []);
});

test("발송 대상 목록은 검토 결과만 검색하고 채널·순서를 유지한다", () => {
  const eligible = [
    { id: "first", name: "김싸피", mmUsername: "kim", year: 15, campus: "서울", channels: ["in_app" as const] },
    { id: "second", name: "박운영", mmUsername: "OPS", year: 0, campus: null, channels: ["mm" as const] },
  ];
  assert.equal(filterEligibleRecipients(eligible, "   "), eligible);
  assert.deepEqual(filterEligibleRecipients(eligible, " OPS "), [eligible[1]]);
  assert.deepEqual(filterEligibleRecipients(eligible, "서울"), [eligible[0]]);
  assert.deepEqual(filterEligibleRecipients(eligible, "15"), []);
  assert.deepEqual(filterEligibleRecipients(eligible, "김싸피"), [eligible[0]]);
  assert.equal(formatRecipientMeta(0, null), "운영진 · 캠퍼스 미지정");
});
