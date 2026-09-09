import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MEMBER_LOGIN_METHOD,
  MEMBER_LOGIN_METHOD_STORAGE_KEY,
  parseMemberLoginMethod,
  persistLastMemberLoginMethod,
  readLastMemberLoginMethod,
} from "../src/lib/member-login-method-preference.client.ts";

function createStorage(initialValue: string | null = null) {
  let value = initialValue;
  return {
    getItem(key: string) {
      assert.equal(key, MEMBER_LOGIN_METHOD_STORAGE_KEY);
      return value;
    },
    setItem(key: string, nextValue: string) {
      assert.equal(key, MEMBER_LOGIN_METHOD_STORAGE_KEY);
      value = nextValue;
    },
    current() {
      return value;
    },
  };
}

test("로그인 방식은 아이디와 이메일 값만 허용한다", () => {
  assert.equal(parseMemberLoginMethod("username"), "username");
  assert.equal(parseMemberLoginMethod("email"), "email");
  assert.equal(parseMemberLoginMethod("identifier"), null);
  assert.equal(parseMemberLoginMethod(null), null);
});

test("저장값이 없거나 손상되면 아이디 방식을 기본값으로 사용한다", () => {
  assert.equal(readLastMemberLoginMethod(createStorage()), DEFAULT_MEMBER_LOGIN_METHOD);
  assert.equal(readLastMemberLoginMethod(createStorage("unknown")), DEFAULT_MEMBER_LOGIN_METHOD);
  assert.equal(readLastMemberLoginMethod(null), DEFAULT_MEMBER_LOGIN_METHOD);
});

test("성공한 로그인 방식만 고정 키에 저장하고 다시 읽는다", () => {
  const storage = createStorage();

  assert.equal(persistLastMemberLoginMethod("email", storage), true);
  assert.equal(storage.current(), "email");
  assert.equal(readLastMemberLoginMethod(storage), "email");
});

test("브라우저 저장소가 차단되어도 로그인 기본 동작을 유지한다", () => {
  const blockedStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };

  assert.equal(readLastMemberLoginMethod(blockedStorage), DEFAULT_MEMBER_LOGIN_METHOD);
  assert.equal(persistLastMemberLoginMethod("email", blockedStorage), false);
});
