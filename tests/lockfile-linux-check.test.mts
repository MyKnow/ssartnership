import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceScript = path.join(projectRoot, "scripts", "check-lockfile-linux.mjs");

function writeExecutable(filePath: string, body: string) {
  writeFileSync(filePath, `#!/bin/sh\nset -eu\n${body}\n`, "utf8");
  chmodSync(filePath, 0o755);
}

type FixtureCommands = {
  dockerBody?: string;
  npmBody?: string;
  npxBody?: string;
};

function createFixture({
  dockerBody =
    'printf "called\\n" > "${LOCKFILE_DOCKER_MARKER}"\nprintf "registry-1.docker.io: 502 Bad Gateway\\n" >&2\nexit 125',
  npmBody =
    'if [ "${1:-}" = "--version" ]; then printf "11.16.0\\n"; else printf "called\\n" > "${LOCKFILE_NPM_MARKER}"; fi',
  npxBody = "exit 97",
}: FixtureCommands = {}) {
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), "ssartnership-lockfile-check-"));
  const scriptsDir = path.join(fixtureRoot, "scripts");
  const binDir = path.join(fixtureRoot, "bin");
  mkdirSync(scriptsDir);
  mkdirSync(binDir);
  copyFileSync(sourceScript, path.join(scriptsDir, "check-lockfile-linux.mjs"));
  writeFileSync(path.join(fixtureRoot, "package-lock.json"), '{"lockfileVersion":3}\n');
  writeExecutable(path.join(binDir, "npm"), npmBody);
  writeExecutable(path.join(binDir, "npx"), npxBody);
  writeExecutable(path.join(binDir, "docker"), dockerBody);

  return { fixtureRoot, binDir };
}

function runFixture(commands: FixtureCommands, githubLinux: boolean) {
  const { fixtureRoot, binDir } = createFixture(commands);
  const dockerMarker = path.join(fixtureRoot, "docker-called");
  const npmMarker = path.join(fixtureRoot, "npm-called");
  const npxMarker = path.join(fixtureRoot, "npx-called");
  const result = spawnSync(
    process.execPath,
    [path.join(fixtureRoot, "scripts", "check-lockfile-linux.mjs")],
    {
      cwd: fixtureRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_ACTIONS: githubLinux ? "true" : "false",
        RUNNER_OS: githubLinux ? "Linux" : "macOS",
        LOCKFILE_DOCKER_MARKER: dockerMarker,
        LOCKFILE_NPM_MARKER: npmMarker,
        LOCKFILE_NPX_MARKER: npxMarker,
        PATH: `${binDir}:${process.env.PATH ?? ""}`,
      },
    },
  );

  const dockerCalled = existsSync(dockerMarker);
  const npmCalled = existsSync(npmMarker);
  const npxCalled = existsSync(npxMarker);
  rmSync(fixtureRoot, { recursive: true, force: true });

  return { result, dockerCalled, npmCalled, npxCalled };
}

test("GitHub Linux lockfile verification uses bundled npm without Docker or npx", () => {
  const { result, dockerCalled, npmCalled, npxCalled } = runFixture({}, true);

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(dockerCalled, false);
  assert.equal(npmCalled, true);
  assert.equal(npxCalled, false);
  assert.match(result.stdout, /bundled npm 11\.16\.0/);
});

test("GitHub Linux lockfile verification still fails closed on drift", () => {
  const { result, dockerCalled } = runFixture(
    {
      npmBody:
        'if [ "${1:-}" = "--version" ]; then printf "11.16.0\\n"; else printf \'{"lockfileVersion":3,"drift":true}\\n\' > package-lock.json; fi',
    },
    true,
  );

  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.equal(dockerCalled, false);
  assert.match(result.stderr, /package-lock\.json changed under Linux\/amd64 resolution/);
});

test("GitHub Linux lockfile verification rejects an unexpected bundled npm", () => {
  const { result, dockerCalled, npxCalled } = runFixture(
    {
      npmBody: 'printf "11.17.0\\n"',
    },
    true,
  );

  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.equal(dockerCalled, false);
  assert.equal(npxCalled, false);
  assert.match(result.stderr, /Expected bundled npm 11\.16\.0, received 11\.17\.0/);
});

test("local Docker infrastructure failures use the pinned npm fallback", () => {
  const { result, dockerCalled, npxCalled } = runFixture(
    {
      npxBody: 'printf "called\\n" > "${LOCKFILE_NPX_MARKER}"',
    },
    false,
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(dockerCalled, true);
  assert.equal(npxCalled, true);
  assert.match(result.stderr, /Docker verification was unavailable/);
});

test("local Docker command failures remain fail closed", () => {
  const { result, npxCalled } = runFixture(
    {
      dockerBody: 'printf "canonical npm failed\\n" >&2\nexit 1',
      npxBody: 'printf "called\\n" > "${LOCKFILE_NPX_MARKER}"',
    },
    false,
  );

  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.equal(npxCalled, false);
  assert.match(result.stderr, /Docker started, but canonical lockfile verification failed/);
  assert.match(result.stderr, /canonical npm failed/);
});

test("local Docker exit 125 without an infrastructure signature remains fail closed", () => {
  const { result, npxCalled } = runFixture(
    {
      dockerBody: 'printf "invalid docker invocation\\n" >&2\nexit 125',
      npxBody: 'printf "called\\n" > "${LOCKFILE_NPX_MARKER}"',
    },
    false,
  );

  assert.equal(result.status, 125, `${result.stdout}\n${result.stderr}`);
  assert.equal(npxCalled, false);
  assert.match(result.stderr, /Docker started, but canonical lockfile verification failed/);
});

test("local fallback still fails closed on lockfile drift", () => {
  const { result, dockerCalled, npxCalled } = runFixture(
    {
      npxBody:
        'printf "called\\n" > "${LOCKFILE_NPX_MARKER}"\nprintf \'{"lockfileVersion":3,"drift":true}\\n\' > package-lock.json',
    },
    false,
  );

  assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.equal(dockerCalled, true);
  assert.equal(npxCalled, true);
  assert.match(result.stderr, /package-lock\.json changed under Linux\/amd64 resolution/);
});

test("lockfile verifier contains no Node 20 Docker dependency", () => {
  const source = readFileSync(sourceScript, "utf8");

  assert.doesNotMatch(source, /node:20/);
  assert.match(source, /CANONICAL_NODE_VERSION = "24\.18\.1"/);
  assert.match(source, /CANONICAL_NPM_VERSION = "11\.16\.0"/);
  assert.match(source, /"npm install --package-lock-only/);
});
