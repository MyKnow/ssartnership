#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

import { repositoryRoot } from "./lib/development-environment.mjs";
import {
  requireSuccessfulResult,
  runNpmArguments,
  runPackageScript,
} from "./lib/package-manager.mjs";

const ALLOWED_RELEASE_TYPES = new Set(["patch", "minor", "major", "none"]);
const CONVENTIONAL_COMMIT_PATTERN =
  /^(?:feat|fix|refactor|docs|test|chore|perf|ci)(?:\([^)]+\))?!?:\s+\S/u;

function parseArguments(argv) {
  const options = {};
  for (const argument of argv) {
    if (argument === "--yes") {
      options.yes = true;
      continue;
    }
    const separator = argument.indexOf("=");
    if (!argument.startsWith("--") || separator < 0) {
      throw new Error(`지원하지 않는 release 인자입니다: ${argument}`);
    }
    options[argument.slice(2, separator)] = argument.slice(separator + 1);
  }
  return options;
}

function runGit(args, { capture = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: capture ? "utf8" : undefined,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.status !== 0 || result.error) {
    const detail = capture ? result.stderr?.trim() : "";
    throw new Error(
      `git ${args.join(" ")} 실행에 실패했습니다.${detail ? ` ${detail}` : ""}`,
    );
  }
  return capture ? result.stdout.trim() : "";
}

function hasGitChanges() {
  const worktree = spawnSync("git", ["diff", "--quiet"], {
    cwd: repositoryRoot,
  });
  const staged = spawnSync("git", ["diff", "--cached", "--quiet"], {
    cwd: repositoryRoot,
  });
  return worktree.status !== 0 || staged.status !== 0;
}

function currentVersion() {
  return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
}

async function askChoice(readline, prompt, choices) {
  while (true) {
    process.stdout.write(`${prompt}\n`);
    choices.forEach((choice, index) => {
      process.stdout.write(`${index + 1}) ${choice.label}\n`);
    });
    const answer = (await readline.question("> ")).trim().toLowerCase();
    const numericIndex = Number(answer) - 1;
    if (Number.isInteger(numericIndex) && choices[numericIndex]) {
      return choices[numericIndex].value;
    }
    const direct = choices.find((choice) => choice.accepts.includes(answer));
    if (direct) {
      return direct.value;
    }
    process.stdout.write("지원하는 값 중 하나를 선택하세요.\n");
  }
}

async function confirm(readline, message) {
  while (true) {
    const answer = (await readline.question(`${message} (y/n): `))
      .trim()
      .toLowerCase();
    if (["y", "yes"].includes(answer)) return true;
    if (["n", "no"].includes(answer)) return false;
  }
}

function readCommitMessage(options) {
  if (options["message-file"]) {
    if (!existsSync(options["message-file"])) {
      throw new Error("--message-file 경로에 파일이 없습니다.");
    }
    return readFileSync(options["message-file"], "utf8").trim();
  }
  return options.message?.trim() || "";
}

function validateCommitMessage(message) {
  const subject = message.split(/\r?\n/u)[0]?.trim() || "";
  if (!CONVENTIONAL_COMMIT_PATTERN.test(subject)) {
    throw new Error(
      "커밋 첫 줄은 한국어 설명을 포함한 conventional commit 형식이어야 합니다.",
    );
  }
}

function runRequiredScript(name) {
  requireSuccessfulResult(runPackageScript(name), `npm run ${name}`);
}

const options = parseArguments(process.argv.slice(2));
const readline = createInterface({ input: process.stdin, output: process.stdout });

try {
  const branch = runGit(["branch", "--show-current"], { capture: true });
  if (!branch) {
    throw new Error("detached HEAD에서는 release를 실행할 수 없습니다.");
  }

  const beforeVersion = currentVersion();
  if (branch === "main") {
    if (hasGitChanges()) {
      throw new Error("main에서 태그를 만들기 전에 변경사항을 정리하세요.");
    }
    const tag = `v${beforeVersion}`;
    const existingTag = spawnSync("git", ["rev-parse", "--verify", tag], {
      cwd: repositoryRoot,
      stdio: "ignore",
    });
    if (existingTag.status === 0) {
      throw new Error(`이미 존재하는 태그입니다: ${tag}`);
    }
    if (!options.yes && !(await confirm(readline, `${branch}에 ${tag}를 생성하고 푸시할까요?`))) {
      process.stdout.write("작업을 취소했습니다.\n");
      process.exit(0);
    }
    runRequiredScript("prepush");
    runGit(["tag", "-a", tag, "-m", tag]);
    runGit(["push", "--no-verify", "origin", branch]);
    runGit(["push", "--no-verify", "origin", tag]);
    process.stdout.write(`릴리즈 완료: ${tag}\n`);
    process.exit(0);
  }

  const lighthouse =
    options.lighthouse ||
    (await askChoice(readline, "Lighthouse 검사를 실행할까요?", [
      { label: "실행", value: "run", accepts: ["run", "y", "yes"] },
      { label: "건너뜀", value: "skip", accepts: ["skip", "n", "no"] },
    ]));
  if (!["run", "skip"].includes(lighthouse)) {
    throw new Error("--lighthouse는 run 또는 skip이어야 합니다.");
  }

  const releaseType =
    options.version ||
    (await askChoice(readline, "버전 업데이트 방식을 선택하세요.", [
      { label: "patch", value: "patch", accepts: ["patch"] },
      { label: "minor", value: "minor", accepts: ["minor"] },
      { label: "major", value: "major", accepts: ["major"] },
      { label: "no update", value: "none", accepts: ["none", "no-update", "skip"] },
    ]));
  if (!ALLOWED_RELEASE_TYPES.has(releaseType)) {
    throw new Error("--version은 patch, minor, major, none 중 하나여야 합니다.");
  }

  let message = readCommitMessage(options);
  while (!message) {
    message = (await readline.question("커밋 메시지: ")).trim();
  }
  validateCommitMessage(message);

  if (releaseType === "none" && !hasGitChanges()) {
    throw new Error("커밋할 변경사항이 없습니다.");
  }

  process.stdout.write(
    `\n브랜치: ${branch}\n현재 버전: ${beforeVersion}\nLighthouse: ${lighthouse}\n버전: ${releaseType}\n커밋 메시지:\n${message}\n\n`,
  );
  if (!options.yes && !(await confirm(readline, "위 설정으로 진행할까요?"))) {
    process.stdout.write("작업을 취소했습니다.\n");
    process.exit(0);
  }

  if (lighthouse === "run") {
    runRequiredScript("perf:lighthouse");
  }
  runRequiredScript("prepush");

  if (releaseType !== "none") {
    requireSuccessfulResult(
      runNpmArguments(["version", releaseType, "--no-git-tag-version"]),
      `npm version ${releaseType}`,
    );
  }
  if (!hasGitChanges()) {
    throw new Error("커밋할 변경사항이 없습니다.");
  }

  runGit(["add", "-A"]);
  runGit(["commit", "-m", message]);
  runGit(["push", "--no-verify", "origin", branch]);
  process.stdout.write(
    `릴리즈 완료: ${beforeVersion} -> ${currentVersion()} (태그 없음)\n`,
  );
} finally {
  readline.close();
}
