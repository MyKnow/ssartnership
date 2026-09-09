import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  formatCronScheduleList,
  getSafeCronErrorCode,
  invokeSelfHostCron,
  loadCronSchedules,
  SelfHostCronError,
} from "./lib/self-host-cron.mjs";

const DEFAULT_CONFIG_URL = new URL("../vercel.json", import.meta.url);

export function parseSelfHostCronArguments(argv) {
  if (argv.length === 1 && argv[0] === "--list") {
    return Object.freeze({ command: "list" });
  }

  if (argv.length === 2 && argv[0] === "--run") {
    return Object.freeze({ command: "run", path: argv[1] });
  }

  throw new SelfHostCronError("CRON_CLI_USAGE");
}

function readScheduleConfig(readFile, configUrl) {
  try {
    return loadCronSchedules(readFile(configUrl));
  } catch (error) {
    if (error instanceof SelfHostCronError) throw error;
    throw new SelfHostCronError("CRON_SCHEDULE_CONFIG_INVALID");
  }
}

export async function runSelfHostCronCli({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = globalThis.fetch,
  readFile = (configUrl) => readFileSync(configUrl, "utf8"),
  configUrl = DEFAULT_CONFIG_URL,
  stdout = (line) => console.log(line),
  stderr = (line) => console.error(line),
} = {}) {
  try {
    const command = parseSelfHostCronArguments(argv);
    const entries = readScheduleConfig(readFile, configUrl);

    if (command.command === "list") {
      for (const line of formatCronScheduleList(entries)) stdout(line);
      return 0;
    }

    const result = await invokeSelfHostCron({
      entries,
      path: command.path,
      baseUrl: env.SELF_HOST_CRON_BASE_URL,
      secret: env.CRON_SECRET,
      fetchImpl,
    });
    stdout(`cron invocation completed: ${result.path}`);
    return 0;
  } catch (error) {
    stderr(`self-host-cron: ${getSafeCronErrorCode(error)}`);
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await runSelfHostCronCli();
}
