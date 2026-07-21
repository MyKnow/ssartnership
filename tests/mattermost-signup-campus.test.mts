import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { classifyMattermostSignupProfile } from "../src/lib/mm-signup-approval.ts";

const repoRoot = new URL("..", import.meta.url).pathname;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("김예린[서울_11반] 프로필은 이름과 서울 캠퍼스를 함께 파싱한다", () => {
  const result = classifyMattermostSignupProfile({
    id: "mm-user-id",
    username: "yerin",
    nickname: "김예린[서울_11반]",
    firstName: "",
    lastName: "",
  });

  assert.equal(result.mode, "direct");
  assert.equal(result.profile.displayName, "김예린");
  assert.equal(result.profile.campus, "서울");
});

test("Mattermost 인증 세션이 파싱된 캠퍼스를 가입 완료 단계로 전달한다", () => {
  const verifyRoute = readRepoFile("src/app/api/mm/code/verify/route.ts");
  const session = readRepoFile("src/lib/mattermost-code-session.ts");
  const completePage = readRepoFile("src/app/auth/signup/complete/page.tsx");
  const completeForm = readRepoFile("src/components/auth/MattermostSignupCompleteForm.tsx");

  assert.match(
    verifyRoute,
    /campus:\s*profileClassification\.profile\.campus\s*\?\?\s*null/,
  );
  assert.match(session, /campus\?:\s*string\s*\|\s*null/);
  assert.match(completePage, /campus:\s*signupSession\.campus/);
  assert.match(completeForm, /campus:\s*string\s*\|\s*null/);
  assert.match(completeForm, /aria-label="캠퍼스"/);
});

test("가입 완료 API와 디렉터리 snapshot에 파싱된 캠퍼스를 저장한다", () => {
  const signupRoute = readRepoFile("src/app/api/mm/signup/route.ts");
  const directoryRepository = readRepoFile("src/lib/mm-directory/repository.ts");

  assert.match(signupRoute, /const campus = verification\.campus\?\.trim\(\) \|\| null/);
  assert.match(signupRoute, /displayName,\n\s+campus,/);
  assert.match(signupRoute, /staff_source_generation:[^\n]+\n\s+campus,/);
  assert.match(directoryRepository, /campus:\s*nextCampus\s*\?\?\s*null/);
});
