import { randomUUID } from "node:crypto";
import { chmod, lstat, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * node-exporter textfile output for the release receiver timer. A lock
 * conflict (exit 75) never starts this process, so it leaves the previous
 * values untouched instead of counting as a failure. The receiver result is
 * never changed by a metrics failure, and a missing textfile directory is
 * skipped rather than created.
 */
export const RECEIVER_METRICS_FILENAME = "release-receiver.prom";

export function previousReceiverSuccess(content) {
  const match = typeof content === "string"
    ? /^ssartnership_release_receiver_last_success_seconds (\d+)$/mu.exec(content)
    : null;
  return match ? Number(match[1]) : 0;
}

export function renderReceiverMetrics({ success, now, previousSuccess = 0 }) {
  const seconds = Math.floor(now / 1000);
  const values = [
    ["last_run_seconds", "Unix time the last receiver run finished.", seconds],
    ["last_result", "Last receiver run result: 1 success (deployed, unchanged or pending), 0 failure.", success ? 1 : 0],
    ["last_success_seconds", "Unix time of the last successful receiver run; 0 before the first success.", success ? seconds : Math.max(0, Math.floor(previousSuccess))],
  ];
  return values.map(([name, help, value]) => `# HELP ssartnership_release_receiver_${name} ${help}\n# TYPE ssartnership_release_receiver_${name} gauge\nssartnership_release_receiver_${name} ${value}\n`).join("");
}

export async function recordReceiverOutcome({ directory, success, now = Date.now() }) {
  if (typeof directory !== "string" || !path.isAbsolute(directory) || directory.includes("\0")) return { recorded: false };
  const metadata = await lstat(directory).catch(() => null);
  if (!metadata?.isDirectory() || metadata.isSymbolicLink()) return { recorded: false };
  const file = path.join(directory, RECEIVER_METRICS_FILENAME);
  const previousSuccess = previousReceiverSuccess(await readFile(file, "utf8").catch(() => ""));
  const temporary = path.join(directory, `.${RECEIVER_METRICS_FILENAME}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, renderReceiverMetrics({ success, now, previousSuccess }), { mode: 0o644, flag: "wx" });
    // The unit runs with UMask=0077; node-exporter reads as an unprivileged user.
    await chmod(temporary, 0o644);
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
  return { recorded: true };
}
