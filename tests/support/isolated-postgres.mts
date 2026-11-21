import { execFileSync, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

/** A disposable local DB. No host mounts, published ports, downloads or app env. */
export function isolatedPostgres(prefix: string) {
  const name = `${prefix}-${process.pid}-${Date.now()}`;
  const docker = (args: string[], input?: string) => execFileSync("docker", args, {
    input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 20_000,
  });
  const command = (application = "integrity-test") => ["exec", "-i", "-e", `PGAPPNAME=${application}`,
    name, "psql", "-X", "-qAt", "-h", "127.0.0.1", "-U", "postgres", "-v", "ON_ERROR_STOP=1"];
  const sql = (input: string) => docker(command(), input).trim();
  return {
    name, sql,
    async start() {
      docker(["run", "--detach", "--pull=never", "--name", name, "--network", "none",
        "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17"]);
      for (let attempt = 0; attempt < 100; attempt += 1) {
        try { sql("select 1"); return; } catch { await delay(100); }
      }
      throw new Error("Disposable PostgreSQL did not become ready");
    },
    stop() { docker(["rm", "-f", name]); },
    async transaction(input: string, application = "integrity-holder") {
      const child = spawn("docker", command(application), { stdio: ["pipe", "pipe", "pipe"] });
      let output = ""; let errors = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { errors += chunk; });
      const complete = new Promise<string>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(errors)));
      });
      // Keep stdin open: the caller owns the transaction commit boundary.
      child.stdin.write(`begin; set local statement_timeout='10s'; ${input}; select 'LOCK_READY';\n`);
      for (let attempt = 0; !output.includes("LOCK_READY"); attempt += 1) {
        if (errors || attempt >= 200) { child.stdin.end("rollback;\n"); await complete; throw new Error(errors || "Transaction coordination timed out"); }
        await delay(10);
      }
      return { async finish(statement = "commit") { child.stdin.end(`${statement};\n`); return complete; } };
    },
    concurrent(input: string, application = "integrity-contender") {
      const child = spawn("docker", command(application), { stdio: ["pipe", "pipe", "pipe"] });
      let output = ""; let errors = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { errors += chunk; });
      const complete = new Promise<{ output: string; errors: string; code: number | null }>((resolve, reject) => {
        child.on("error", reject);
        child.on("close", (code) => resolve({ output: output.trim(), errors, code }));
      });
      child.stdin.end(`set statement_timeout='10s'; ${input};\n`);
      return complete;
    },
    async waitForLock(application = "integrity-contender") {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (sql(`select count(*) from pg_stat_activity where application_name='${application}' and wait_event_type='Lock'`) === "1") return;
        await delay(20);
      }
      throw new Error("Contender did not reach the expected DB lock");
    },
  };
}
