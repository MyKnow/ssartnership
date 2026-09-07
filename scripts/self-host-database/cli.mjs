import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { composeEnvironment, createDatabaseEnvironment, createMigrationPlan, deriveProjectName, loadDatabaseEnvironment, renderMigrationRunnerSql, resolveSignedStorageUrl, validateProjectName, writeNewEnvironmentFile } from "./lib.mjs";
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const compose = resolve(root, "compose.supabase.yaml");
const migrations = resolve(root, "supabase/migrations");
const fail = code => {
  throw new Error(`self-host database command error: ${code}`);
};
function options(argv) {
  const [command, ...values] = argv;
  if (!command || command === "--help" || command === "-h") return {
    command: "help"
  };
  if (!new Set(["init", "up", "migrate", "status", "smoke", "down"]).has(command)) fail("command_invalid");
  const result = {
    command,
    expectPersistence: false
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--expect-persistence") {
      if (result.expectPersistence) fail("option_duplicate");
      result.expectPersistence = true;
      continue;
    }
    if (!["--env-file", "--project", "--port"].includes(value) || index + 1 === values.length) fail("option_invalid");
    const key = value.slice(2).replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
    if (result[key]) fail("option_duplicate");
    result[key] = values[++index];
  }
  if (!result.envFile) fail("env_file_required");
  if (result.port && command !== "init") fail("port_only_for_init");
  if (result.expectPersistence && command !== "smoke") fail("option_invalid");
  return result;
}
function run(command, args, input, timeoutMs = 120000) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env: composeEnvironment(),
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"]
    });
    const limit = 12000;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const append = (current, chunk) => `${current}${chunk}`.slice(-limit);
    child.stdout.on("data", chunk => {
      stdout = append(stdout, chunk);
    });
    // Drain stderr even on successful psql runs: PostgreSQL NOTICE output can
    // otherwise fill the pipe while replaying the complete migration history.
    child.stderr.on("data", chunk => {
      stderr = append(stderr, chunk);
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.on("error", () => {
      clearTimeout(timeout);
      reject(new Error("self-host database command unavailable"));
    });
    child.on("close", code => {
      clearTimeout(timeout);
      if (code === 0 && !timedOut) {
        resolveResult(stdout);
        return;
      }
      const error = new Error(timedOut ? `self-host database command timed out:${command}` : `self-host database command failed:${command}:${code ?? "unknown"}`);
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
    if (input !== undefined) child.stdin.end(input);
  });
}
const composeArgs = (file, project, args) => ["compose", "--env-file", file, "--project-name", project, "--file", compose, ...args];
const runCompose = (file, project, args, input, timeoutMs) => run("docker", composeArgs(file, project, args), input, timeoutMs);
const psql = (file, project, sql, fields = false) => runCompose(
  file,
  project,
  [
    "exec", "-T", "db", "psql", "--no-psqlrc", "--set", "ON_ERROR_STOP=1",
    "--username", "postgres", "--dbname", "postgres",
    ...(fields ? ["--tuples-only", "--no-align", "--field-separator", "\t"] : []),
  ],
  sql,
  600000,
);
async function ready(env, file, project) {
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/status`);
  if (!response.ok) fail("storage_api_not_ready");
  const tables = await psql(file, project, "select case when to_regclass('storage.buckets') is not null and to_regclass('storage.objects') is not null then 'ready' else 'missing' end;\n", true);
  if (tables.trim() !== "ready") fail("storage_schema_not_ready");
}
async function plan() {
  return createMigrationPlan(await Promise.all((await readdir(migrations)).filter(name => name.endsWith(".sql")).sort().map(async name => ({
    name,
    source: await readFile(resolve(migrations, name), "utf8")
  }))));
}
const headers = (key, extra = {}) => ({
  apikey: key,
  authorization: `Bearer ${key}`,
  ...extra
});
async function request(url, init = {}, accepted = [200, 201]) {
  const response = await fetch(url, init);
  if (!accepted.includes(response.status)) throw new Error(`self-host database smoke request failed:${init.method ?? "GET"}:${new URL(url).pathname}:${response.status}`);
  return response;
}
async function bucket(base, key, id, isPublic) {
  const response = await fetch(`${base}/bucket`, {
    method: "POST",
    headers: headers(key, {
      "content-type": "application/json"
    }),
    body: JSON.stringify({
      id,
      name: id,
      public: isPublic
    })
  });
  if ([200, 201].includes(response.status)) return;
  // Storage reports duplicate buckets as 400 on some releases. Do not treat
  // every 400 as success: verify the existing bucket and its access policy.
  const existing = await fetch(`${base}/bucket/${id}`, { headers: headers(key) });
  if (existing.ok) {
    const value = await existing.json();
    if (value.id === id && value.public === isPublic) return;
  }
  throw new Error(`self-host database smoke request failed:POST:/storage/v1/bucket:${response.status}`);
}
async function smoke(env, file, project, persisted) {
  await ready(env, file, project);
  const rest = `${env.SUPABASE_URL}/rest/v1`,
    storage = `${env.SUPABASE_URL}/storage/v1`,
    service = env.SUPABASE_SERVICE_ROLE_KEY,
    id = randomUUID(),
    category = {
      id,
      key: `self-host-smoke-${id}`,
      label: "self-host smoke"
    };
  try {
    await request(`${rest}/categories`, {
      method: "POST",
      headers: headers(service, {
        "content-type": "application/json",
        prefer: "return=representation"
      }),
      body: JSON.stringify(category)
    });
    const selected = await (await request(`${rest}/categories?id=eq.${id}&select=id,key`, {
      headers: headers(service)
    })).json();
    if (selected.length !== 1 || selected[0].id !== id || selected[0].key !== category.key) fail("rest_round_trip_mismatch");
    await request(`${rest}/rpc/get_admin_dashboard_counts`, {
      method: "POST",
      headers: headers(service, {
        "content-type": "application/json"
      }),
      body: "{}"
    });
    if ((await fetch(`${rest}/categories`, {
      method: "POST",
      headers: headers(env.SUPABASE_ANON_KEY, {
        "content-type": "application/json"
      }),
      body: JSON.stringify({
        ...category,
        id: randomUUID(),
        key: `${category.key}-anon`
      })
    })).ok) fail("anon_write_not_denied");
    const publicBucket = "self-host-smoke-public",
      privateBucket = "self-host-smoke-private",
      persistence = "persistence-marker.txt",
      privatePath = "signed-marker.txt";
    await bucket(storage, service, publicBucket, true);
    await bucket(storage, service, privateBucket, false);
    if (persisted) await request(`${storage}/object/${publicBucket}/${persistence}`, {
      headers: headers(service)
    });else await request(`${storage}/object/${publicBucket}/${persistence}`, {
      method: "POST",
      headers: headers(service, {
        "content-type": "text/plain",
        "x-upsert": "true"
      }),
      body: "ssartnership self-host persistence marker\n"
    });
    const publicObject = await request(`${storage}/object/public/${publicBucket}/${persistence}`);
    if (await publicObject.text() !== "ssartnership self-host persistence marker\n") fail("storage_persistence_content_mismatch");
    await request(`${storage}/object/${privateBucket}/${privatePath}`, {
      method: "POST",
      headers: headers(service, {
        "content-type": "text/plain",
        "x-upsert": "true"
      }),
      body: "ssartnership self-host signed storage marker\n"
    });
    if ((await fetch(`${storage}/object/public/${privateBucket}/${privatePath}`)).ok) fail("private_storage_publicly_readable");
    const signed = await (await request(`${storage}/object/sign/${privateBucket}/${privatePath}`, {
      method: "POST",
      headers: headers(service, {
        "content-type": "application/json"
      }),
      body: JSON.stringify({
        expiresIn: 60
      })
    })).json();
    if (typeof signed.signedURL !== "string") fail("storage_signed_url_missing");
    const signedObject = await request(resolveSignedStorageUrl(storage, signed.signedURL));
    if (await signedObject.text() !== "ssartnership self-host signed storage marker\n") fail("storage_signed_content_mismatch");
  } finally {
    const cleanup = await fetch(`${rest}/categories?id=eq.${id}`, {
      method: "DELETE",
      headers: headers(service)
    });
    if (!cleanup.ok && cleanup.status !== 404) fail("smoke_cleanup_failed");
  }
}
async function main() {
  const input = options(process.argv.slice(2));
  if (input.command === "help") {
    process.stdout.write("usage: node scripts/self-host-database/cli.mjs <init|up|migrate|status|smoke|down> --env-file <ignored .tmp path> [--project <ssartnership-name>] [--port <1024-65535>] [--expect-persistence]\n");
    return;
  }
  const file = resolve(root, input.envFile);
  if (input.command === "init") {
    const env = createDatabaseEnvironment({
      environmentFile: file,
      port: input.port,
      project: input.project ?? deriveProjectName(file)
    });
    process.stdout.write(`self-host database environment initialized: ${await writeNewEnvironmentFile(file, env, root)}\n`);
    return;
  }
  const env = await loadDatabaseEnvironment(file),
    project = input.project ?? env.COMPOSE_PROJECT_NAME;
  validateProjectName(project);
  if (project !== env.COMPOSE_PROJECT_NAME) fail("project_env_mismatch");
  if (input.command === "up") {
    const volumes = await run("docker", ["volume", "ls", "--filter", `name=^${project}_pgbackrest-repo$`, "--format", "{{.Name}}"]);
    const labels = await run("docker", ["ps", "--all", "--filter", `label=com.docker.compose.project=${project}`, "--format", '{{.Label "io.ssartnership.backup-managed"}}']);
    if (volumes.trim().split(/\r?\n/u).includes(`${project}_pgbackrest-repo`) || labels.split(/\r?\n/u).includes("true")) {
      fail("backup_managed_use_operations_compose_overlay");
    }
    await runCompose(file, project, ["up", "--detach", "--wait", "--wait-timeout", "90"]);
    await ready(env, file, project);
    process.stdout.write("self-host database stack is ready; run migrate before application use\n");
    return;
  }
  if (input.command === "migrate") {
    await ready(env, file, project);
    try {
      const migrationsPlan = await plan();
      await psql(file, project, renderMigrationRunnerSql(migrationsPlan));
      process.stdout.write(`self-host database migrations applied: ${migrationsPlan.length}\n`);
    } catch (cause) {
      const last = typeof cause.stdout === "string" ? [...cause.stdout.matchAll(/self_host_migration:([^\s]+)/gu)].at(-1)?.[1] : null;
      throw new Error(`self-host database migration failed${last ? `:${last}` : ""}`);
    }
    return;
  }
  if (input.command === "status") {
    const services = await runCompose(file, project, ["ps", "--format", "json"]),
      ledger = await psql(file, project, "select count(*), coalesce(max(name), '') from self_host.migration_ledger;\n", true),
      [count = "0", latest = ""] = ledger.trim().split("\t");
    process.stdout.write(`project=${project}\nservices=${services.trim() || "[]"}\nmigrations=${count}\nlatest_migration=${latest}\n`);
    return;
  }
  if (input.command === "smoke") {
    await smoke(env, file, project, input.expectPersistence);
    process.stdout.write(`self-host database smoke passed${input.expectPersistence ? " with persistence marker" : ""}\n`);
    return;
  }
  await runCompose(file, project, ["down"]);
  process.stdout.write("self-host database stack stopped; named data volumes were preserved\n");
}
main().catch(cause => {
  process.stderr.write(`${cause instanceof Error ? cause.message : "self-host database command failed"}\n`);
  process.exitCode = 1;
});
