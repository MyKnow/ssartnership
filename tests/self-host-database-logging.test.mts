import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const yaml: { load: (source: string) => unknown } = createRequire(import.meta.url)("js-yaml");

const privacy = ["log_statement=none", "log_min_error_statement=panic", "log_error_verbosity=terse", "log_parameter_max_length_on_error=0"];
for (const [file, service] of [["compose.supabase.yaml", "db"], ["compose.operations.yaml", "db"], ["compose.operations.yaml", "restore-drill-db"]]) {
  test(`${file} ${service} protects SQL bodies from the initial postgres process`, async () => {
    const document = yaml.load(await readFile(new URL(`../${file}`, import.meta.url), "utf8")) as { services: Record<string, { command?: string[] }> };
    const command = document.services[service].command ?? [];
    assert.deepEqual(command.slice(0, 3), ["postgres", "-D", "/etc/postgresql"]);
    for (const setting of privacy) {
      const occurrences = command.filter((arg) => arg.startsWith(`${setting.split("=")[0]}=`));
      assert.deepEqual(occurrences, [setting]);
      assert.equal(command[command.indexOf(setting) - 1], "-c");
    }
    assert.ok(!command.some((arg) => arg.startsWith("log_min_messages=")), "error severity must not be suppressed");
  });
}
