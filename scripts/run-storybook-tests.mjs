import { spawn } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const vitestCliPath = join(scriptDirectory, "..", "node_modules", "vitest", "vitest.mjs");
const vitestArgs = [
  "run",
  "--project=storybook",
  "--reporter=default",
  "--reporter=hanging-process",
];

const vitestCloseTimeoutPattern = /(?:^|\r?\n)[^\r\n]*close timed out after \d+(?:\.\d+)?ms(?:\r?\n|$)/iu;

export function hasStorybookTeardownTimeout(output) {
  return vitestCloseTimeoutPattern.test(output);
}

export function resolveStorybookTestExitCode({ exitCode, signal, output }) {
  if (hasStorybookTeardownTimeout(output)) {
    return 1;
  }

  if (signal || exitCode === null) {
    return 1;
  }

  return exitCode;
}

export function isDirectExecution(moduleUrl, executedPath) {
  return Boolean(executedPath) && moduleUrl === pathToFileURL(resolve(executedPath)).href;
}

export function runStorybookTests({
  command = process.execPath,
  args = [vitestCliPath, ...vitestArgs],
  cwd = process.cwd(),
  createProcess = spawn,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  return new Promise((resolve, reject) => {
    const child = createProcess(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";

    const forward = (stream, target) => {
      stream.on("data", (chunk) => {
        output += chunk.toString();
        target.write(chunk);
      });
    };

    forward(child.stdout, stdout);
    forward(child.stderr, stderr);
    child.once("error", reject);
    child.once("close", (exitCode, signal) => {
      const resolvedExitCode = resolveStorybookTestExitCode({
        exitCode,
        signal,
        output,
      });

      if (resolvedExitCode === 1 && hasStorybookTeardownTimeout(output)) {
        stderr.write(
          "[storybook-test] Vitest 종료 timeout이 감지되어 성공 코드를 거부합니다.\n",
        );
      }

      resolve(resolvedExitCode);
    });
  });
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  const exitCode = await runStorybookTests();
  process.exitCode = exitCode;
}
