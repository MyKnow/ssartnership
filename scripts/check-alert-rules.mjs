#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Runs the Prometheus rule unit tests and the Alertmanager config check with
 * the exact digest-pinned images the operations VM runs. No network, a
 * read-only root and a private /tmp, like the runbook's manual check.
 */
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const COMPOSE = "deploy/pve/compose.operations.yaml";

export const RULE_TESTS = Object.freeze([
  "deploy/pve/service-alerts.test.yml",
  "deploy/observability/alerts.test.yml",
  "deploy/observability/production-backup-alerts.test.yml",
  "deploy/observability/restored-service-alerts.test.yml",
]);

export const ALERTMANAGER_CONFIGS = Object.freeze([
  "deploy/pve/alertmanager.yml",
  "deploy/observability/alertmanager.yml",
]);

/** Paths whose change requires `npm run check:alerts` (see verify-change). */
export const ALERT_RULE_PATH = /^deploy\/(?:pve|observability)\/(?:[^/]*alerts[^/]*\.ya?ml|alertmanager\.yml|prometheus\.yml)$/u;

export function changesAlertRules(paths) {
  return paths.some((item) => ALERT_RULE_PATH.test(item));
}

export function pinnedImages(composeSource) {
  const find = (name) => {
    const match = new RegExp(`image: (prom/${name}:v[0-9.]+@sha256:[a-f0-9]{64})`, "u").exec(composeSource);
    if (!match) throw new Error(`ALERT_CHECK_IMAGE_UNPINNED:${name}`);
    return match[1];
  };
  return { prometheus: find("prometheus"), alertmanager: find("alertmanager") };
}

export function alertCheckCommands(images, root = ROOT) {
  const mount = `${path.join(root, "deploy")}:/deploy:ro`;
  const base = ["run", "--rm", "--read-only", "--tmpfs", "/tmp", "--network", "none", "-v", mount];
  return [
    ...RULE_TESTS.map((file) => ({
      label: `promtool test rules ${file}`,
      args: [...base, "-w", `/${path.posix.dirname(file)}`, "--entrypoint", "promtool", images.prometheus, "test", "rules", path.posix.basename(file)],
    })),
    ...ALERTMANAGER_CONFIGS.map((file) => ({
      label: `amtool check-config ${file}`,
      args: [...base, "--entrypoint", "amtool", images.alertmanager, "check-config", `/${file}`],
    })),
  ];
}

function main() {
  const images = pinnedImages(readFileSync(path.join(ROOT, COMPOSE), "utf8"));
  const docker = spawnSync("docker", ["version", "--format", "{{.Server.Version}}"], { encoding: "utf8" });
  if (docker.status !== 0) {
    process.stderr.write("경보 규칙 검사에는 Docker가 필요합니다. Docker를 실행한 뒤 다시 시도해 주세요.\n");
    process.exit(1);
  }
  for (const command of alertCheckCommands(images)) {
    process.stdout.write(`▶ ${command.label}\n`);
    const result = spawnSync("docker", command.args, { stdio: "inherit" });
    if (result.status !== 0) {
      process.stderr.write(`경보 규칙 검사 실패: ${command.label}\n`);
      process.exit(1);
    }
  }
  process.stdout.write("경보 규칙 검사 통과\n");
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
