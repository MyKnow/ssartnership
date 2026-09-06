#!/usr/bin/env node
import { mkdir, open, readFile, writeFile, symlink, chmod } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { assertOperatorInput } from "../../scripts/self-host-ci/lib.mjs";

export const TIMERS = Object.freeze({
  collect: "OnBootSec=2min\nOnUnitActiveSec=1min\nAccuracySec=5s",
  "db-check": "OnBootSec=5min\nOnUnitActiveSec=15min",
  "backup-full": "OnCalendar=Sun *-*-* 03:00:00 Asia/Seoul\nPersistent=true",
  "backup-incr": "OnCalendar=Mon..Sat *-*-* 03:00:00 Asia/Seoul\nPersistent=true",
  check: "OnCalendar=Sun *-*-* 05:00:00 Asia/Seoul\nPersistent=true",
  restore: "OnCalendar=Sat *-*-1..7 06:00:00 Asia/Seoul\nPersistent=true",
});
export function timerUnit(command, schedule) {
  if (!Object.hasOwn(TIMERS, command) || TIMERS[command] !== schedule) throw new Error("MAINTENANCE_TIMER_INVALID");
  return `[Unit]\nDescription=SSARTNERSHIP Preview ${command} schedule\n\n[Timer]\n${schedule}\nUnit=ssartnership-maintenance@${command}.service\n\n[Install]\nWantedBy=timers.target\n`;
}
async function install() {
  if (process.getuid?.() !== 0) throw new Error("MAINTENANCE_OPERATOR_REQUIRED");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  await assertOperatorInput(root, { directory: true });
  await assertOperatorInput("/etc/myknow/secrets/ssartnership-preview/deployment.json");
  const state = JSON.parse(await readFile("/etc/myknow/secrets/ssartnership-preview/deployment.json", "utf8"));
  if (state.environment !== "synthetic-preview" || state.productionCutover !== false) throw new Error("MAINTENANCE_PREVIEW_REQUIRED");
  await mkdir("/opt/ssartnership/control", { mode: 0o755, recursive: true });
  await assertOperatorInput("/opt/ssartnership/control", { directory: true });
  // New installation only. An upgrade must retain and explicitly replace the
  // previous controller/unit versions after review, not overwrite this guard.
  await symlink(root, "/opt/ssartnership/control/current");
  await chmod(path.join(root, "deploy/self-host-ci/maintenance-run.sh"), 0o555);
  const lock = await open("/var/lib/ssartnership-ci/heavy.lock", "wx", 0o600);
  await lock.close();
  const service = "ssartnership-maintenance@.service";
  await writeFile(`/etc/systemd/system/${service}`, await readFile(path.join(root, "deploy/self-host-ci", service)), { flag: "wx", mode: 0o644 });
  const units = [];
  for (const [command, schedule] of Object.entries(TIMERS)) {
    const unit = `ssartnership-${command}.timer`;
    await writeFile(`/etc/systemd/system/${unit}`, timerUnit(command, schedule), { flag: "wx", mode: 0o644 });
    units.push(unit);
  }
  execFileSync("systemd-analyze", ["verify", `/etc/systemd/system/${service}`, ...units.map((unit) => `/etc/systemd/system/${unit}`)], { stdio: "pipe" });
  execFileSync("systemctl", ["daemon-reload"], { stdio: "pipe" });
  execFileSync("systemctl", ["enable", "--now", ...units], { stdio: "pipe" });
  return { installed: true, timers: units, offhostTimerEnabled: false, productCronEnabled: false };
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  try { console.log(JSON.stringify(await install())); }
  catch { console.error('{"error":"MAINTENANCE_INSTALL_FAILED"}'); process.exitCode = 1; }
}
