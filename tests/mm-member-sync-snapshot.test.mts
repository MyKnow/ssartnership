import assert from "node:assert/strict";
import test from "node:test";
import { buildMattermostProfileSyncPatch } from "@/lib/member-domain";
import type { MattermostUser } from "@/lib/mattermost/client";
import {
  getMattermostDisplayName,
  toMemberSyncSnapshot,
} from "@/lib/mm-member-sync/snapshot";

function createUser(overrides: Partial<MattermostUser> = {}): MattermostUser {
  return {
    id: "mattermost-user",
    username: "member.username",
    nickname: "홍길동",
    firstName: "길동",
    lastName: "홍",
    deleteAt: 0,
    ...overrides,
  };
}

test("프로필 동기화는 닉네임의 소속·역할을 제거하고 실명을 보존한다", () => {
  const cases = [
    ["홍길동[서울_6반_A601]팀원", "홍길동"],
    ["김하나[서울_10반]", "김하나"],
    ["김하나[서울_마고데]", "김하나"],
    ["이하나(교육프로)", "이하나"],
    ["김하나【서울_10반】", "김하나"],
    ["홍길동", "홍길동"],
    ["남궁민수[서울_1반]", "남궁민수"],
    ["남궁민수", "남궁민수"],
  ];

  for (const [nickname, expected] of cases) {
    assert.equal(getMattermostDisplayName(createUser({ nickname })), expected, nickname);
  }
});

test("인식할 수 없는 닉네임과 실명·사용자명 fallback은 그대로 보존한다", () => {
  assert.equal(getMattermostDisplayName(createUser({ nickname: " Jane Doe " })), "Jane Doe");
  assert.equal(getMattermostDisplayName(createUser({ nickname: "운영 지원 봇" })), "운영 지원 봇");
  assert.equal(getMattermostDisplayName(createUser({ nickname: "SSAFY 교육프로" })), "SSAFY 교육프로");
  assert.equal(getMattermostDisplayName(createUser({ nickname: " ", firstName: " Jane ", lastName: " Doe " })), "Jane Doe");
  assert.equal(getMattermostDisplayName(createUser({ nickname: "", firstName: "", lastName: "홍" })), "홍");
  assert.equal(getMattermostDisplayName(createUser({ nickname: "", firstName: "", lastName: "" })), "member.username");
});

test("동기화 스냅샷은 이름만 파싱하며 입력과 로컬 소속 정보는 변경하지 않는다", () => {
  const user = createUser({ nickname: "이하나(교육프로)", firstName: "다른이름" });
  const original = structuredClone(user);
  const snapshot = toMemberSyncSnapshot({ user, image: null });

  assert.equal(snapshot.displayName, "이하나");
  assert.equal(snapshot.mmUserId, user.id);
  assert.equal(snapshot.mmUsername, user.username);
  assert.equal(snapshot.campus, null);
  assert.equal(snapshot.track, null);
  assert.equal(snapshot.trackName, null);
  assert.deepEqual(user, original);
});

test("정상 실명을 닉네임 원문으로 덮어쓰지 않고 기존 오염된 이름은 정리한다", () => {
  const snapshot = toMemberSyncSnapshot({
    user: createUser({ nickname: "홍길동[서울_6반_A601]팀원" }),
    image: null,
  });
  const existingName = buildMattermostProfileSyncPatch(
    { displayName: "홍길동", mmUsername: snapshot.mmUsername },
    snapshot,
  );
  assert.deepEqual(existingName.member, {});
  assert.deepEqual(existingName.changedFields, []);

  const pollutedName = buildMattermostProfileSyncPatch(
    { displayName: "홍길동[서울_6반_A601]팀원", mmUsername: snapshot.mmUsername },
    snapshot,
  );
  assert.deepEqual(pollutedName.member, { display_name: "홍길동" });
  assert.deepEqual(pollutedName.changedFields, ["displayName"]);
});
