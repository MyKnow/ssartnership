import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFile(new URL(path, root), "utf8");

test("인증 코드 발송은 대상 확인과 DM 전송에 Sender 세션 하나를 재사용한다", async () => {
  const service = await read("src/lib/mattermost-code-verification.ts");

  assert.match(service, /withMattermostVerificationTargetSession/);
  assert.match(service, /session\.sendDirectMessage\(/);
  assert.doesNotMatch(service, /findUserInGeneration/);
});

test("인증 코드 발송은 브라우저 응답 대신 서버 보안 로그용 시간 지표를 만든다", async () => {
  const [service, route] = await Promise.all([
    read("src/lib/mattermost-code-verification.ts"),
    read("src/app/api/mm/code/issue/route.ts"),
  ]);

  assert.match(service, /targetLookupMs/);
  assert.match(service, /sendDmMs/);
  assert.match(service, /totalMs/);
  assert.match(route, /deliveryStatus/);
  assert.doesNotMatch(route, /username:\s*parsed\.data\.username/);
  assert.doesNotMatch(route, /properties:\s*\{[^}]*\busername\s*:/);
  assert.doesNotMatch(route, /properties:\s*\{[^}]*\bcode\s*:/);
});

test("기존 회원 인증은 로그인으로 한 번만 이동하고 토스트 플래그를 전달한다", async () => {
  const form = await read("src/components/auth/MattermostCodeVerificationForm.tsx");
  const login = await read("src/components/auth/LoginForm.tsx");

  assert.match(form, /sessionStorage\.setItem\("signup:alreadyRegistered", "1"\)/);
  assert.match(form, /router\.replace\(nextPath\)/);
  assert.doesNotMatch(form, /router\.replace\(nextPath\);\s*router\.refresh\(\)/);
  assert.match(login, /notify\("이미 가입된 회원입니다\."\)/);
});

test("Mattermost 인증 입력은 기수를 먼저 받고 첫 오류 focus도 같은 순서를 따른다", async () => {
  const form = await read("src/components/auth/MattermostCodeVerificationForm.tsx");
  const generationField = form.indexOf("기수\n        <Select");
  const usernameField = form.indexOf("Mattermost ID\n        <Input");
  const generationFocus = form.indexOf("if (nextErrors.generation)");
  const usernameFocus = form.indexOf("if (nextErrors.username)");

  assert.ok(generationField >= 0);
  assert.ok(usernameField > generationField);
  assert.ok(generationFocus >= 0);
  assert.ok(usernameFocus > generationFocus);
  assert.match(form, /placeholder="예시: myknow"/);
  assert.match(form, /className="mt-2 w-full"[^>]*>\s*Mattermost로 인증 코드 받기/);
});
