import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

function trackedFiles(prefixes: string[]) {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", ...prefixes], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter((path) => path && existsSync(new URL(`../${path}`, import.meta.url)));
}

test("폐기 공급자의 Git 자동 배포는 모든 브랜치에서 차단하고 런타임·cron 설정을 되살리지 않는다", () => {
  const configurationPath = new URL("../vercel.json", import.meta.url);
  assert.ok(existsSync(configurationPath), "keep the deployment stop while the external Git integration is connected");
  const configuration = JSON.parse(readFileSync(configurationPath, "utf8"));

  assert.equal(configuration.git?.deploymentEnabled, false);
  assert.deepEqual(Object.keys(configuration.git), ["deploymentEnabled"]);
  assert.deepEqual(Object.keys(configuration).sort(), ["$schema", "git"]);
});

test("런타임·스크립트·배포·워크플로에는 Vercel 참조가 없다", () => {
  const offenders = trackedFiles(["src", "scripts", "deploy", ".github", "next.config.ts", "Dockerfile"])
    .filter((path) => /vercel/iu.test(readFileSync(new URL(`../${path}`, import.meta.url), "utf8")));

  assert.deepEqual(offenders, []);
});

test("vercel.app 기본 주소는 코드와 스토리에서 사라졌다", () => {
  const offenders = trackedFiles(["src", "scripts", "deploy"])
    .filter((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").includes("ssartnership.vercel.app"));

  assert.deepEqual(offenders, []);
});
