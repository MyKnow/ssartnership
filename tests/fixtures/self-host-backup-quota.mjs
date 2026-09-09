import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeOffhost } from "../../scripts/self-host-operations/offhost.mjs";
import { parseEnvText, serializeEnvironment } from "../../scripts/self-host-operations/lib.mjs";

const directory = await mkdtemp(path.resolve(".tmp/self-host/quota-"));
const env = parseEnvText(await readFile(".tmp/self-host/receiver/offhost.env", "utf8"));
const file = path.join(directory, "offhost.env");
await writeFile(file, serializeEnvironment({ ...env, OFFHOST_REPOSITORY: "rest:https://host.docker.internal:58444/backup/ssartnership/" }), { mode: 0o600, flag: "wx" });
await assert.rejects(() => executeOffhost(["init", "--env-file", ".tmp/self-host/data.env", "--operations-env-file", ".tmp/self-host/operations.env", "--offhost-env-file", file]));
process.stdout.write('{"receiverQuotaInitializationDenied":true}\n');
