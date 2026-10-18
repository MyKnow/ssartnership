import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readUnit = (name: string) => readFileSync(new URL(`../deploy/self-host-operations/production-backup/${name}`, import.meta.url), "utf8");
const base = readUnit("ssartnership-production-backup.service");
const online = readUnit("online-backup.conf");
const sharedLock = "/var/lib/ssartnership-ci/heavy.lock";

function lastDirective(source: string, name: string) {
  return source.split("\n").filter((line) => line.startsWith(`${name}=`)).at(-1)?.slice(name.length + 1);
}

function optionValue(args: string[], names: string[]) {
  const index = args.findIndex((arg) => names.includes(arg) || names.some((name) => arg.startsWith(`${name}=`)));
  if (index === -1) return undefined;
  return args[index].includes("=") ? args[index].split("=")[1] : args[index + 1];
}

for (const [profile, source] of [["cold", base], ["online", `${base}\n${online}`]] as const) {
  test(`${profile} backup waits for short heavy-lock contention and reports exhausted waits as failures`, () => {
    const [executable, ...args] = (lastDirective(source, "ExecStart") ?? "").split(/\s+/u);
    assert.equal(executable, "/usr/bin/flock");
    assert.equal(args.filter((arg) => arg === sharedLock).length, 1);
    const options = args.slice(0, args.indexOf(sharedLock));
    assert.ok(!options.some((arg) => ["--nonblock", "--nb", "-n"].includes(arg)), "a scheduled backup must wait through brief contention");
    assert.ok(!options.some((arg) => ["--shared", "-s", "--unlock", "-u"].includes(arg)), "the heavy lock must stay exclusive");
    const waitSeconds = Number(optionValue(options, ["--timeout", "--wait", "-w"]));
    assert.ok(Number.isFinite(waitSeconds) && waitSeconds > 0 && waitSeconds <= 300, "lock wait must be positive and bounded to five minutes");
    assert.equal(optionValue(options, ["--conflict-exit-code", "-E"]), "75");
    assert.ok(!(lastDirective(source, "SuccessExitStatus") ?? "").split(/\s+/u).includes("75"), "exhausted backup waits must remain visible failures");
    assert.equal(args.at(-1), "capture");
  });
}

test("bounded lock waiting preserves the cold and online capture profiles and resource limits", () => {
  assert.match(lastDirective(base, "ExecStart") ?? "", /\/production-backup-20260909\/production-cold-backup\.mjs capture$/u);
  assert.match(lastDirective(base, "ExecStopPost") ?? "", /\/production-cold-backup\.mjs resume$/u);
  assert.equal(lastDirective(base, "TimeoutStartSec"), "15min");
  assert.equal(lastDirective(base, "TimeoutStopSec"), "3min");
  assert.equal(lastDirective(base, "MemoryMax"), "512M");
  assert.equal(lastDirective(base, "CPUQuota"), "100%");
  assert.equal(lastDirective(base, "KillMode"), "control-group");

  assert.match(online, /^ExecStart=$/mu, "the online drop-in must replace the cold command");
  assert.match(lastDirective(online, "ExecStart") ?? "", /\/operator-online-20260910\/scripts\/self-host-operations\/production-online-backup\.mjs capture$/u);
  assert.equal(lastDirective(online, "ExecStopPost"), "");
  assert.equal(lastDirective(online, "TimeoutStartSec"), "30min");
  assert.equal(lastDirective(online, "MemoryMax"), "1536M");
});
