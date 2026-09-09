import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  createBuildEnvironmentManifest,
  validateSelfHostRuntimeEnvironment,
} from "../deploy/self-host/runtime-env.mjs";
import {
  createLocalRuntimeEnvironment,
  writeLocalRuntimeEnvironment,
} from "../deploy/self-host/write-local-runtime-env.mjs";

const secret = randomBytes(32).toString("hex");
const senderKey = Buffer.alloc(32, 9).toString("base64");
const execFile = promisify(execFileCallback);

function createRealBuildEnvironment() {
  return {
    NEXT_PUBLIC_DATA_SOURCE: "supabase",
    NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "supabase",
    NEXT_PUBLIC_SUPABASE_URL: "https://public-supabase.test",
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
  };
}

function createRealRuntimeEnvironment() {
  return {
    ...createRealBuildEnvironment(),
    SELF_HOST_MODE: "real",
    SUPABASE_URL: "https://public-supabase.test",
    SUPABASE_INTERNAL_URL: "http://gateway:8000",
    SUPABASE_ANON_KEY: secret,
    SUPABASE_SERVICE_ROLE_KEY: secret,
    ADMIN_SESSION_SECRET: secret,
    USER_SESSION_SECRET: secret,
    PARTNER_SESSION_SECRET: secret,
    CERTIFICATION_QR_SECRET: secret,
    MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET: secret,
    MEMBER_EMAIL_VERIFICATION_HMAC_SECRET: secret,
    GRADUATE_VERIFICATION_HMAC_SECRET: secret,
    MM_BASE_URL: "https://mattermost.test",
    MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION: "1",
    MM_SENDER_CREDENTIALS_KEY_V1: senderKey,
    CRON_SECRET: secret,
  };
}

function diagnosticCodes(environment: Record<string, string>, manifest: unknown) {
  return validateSelfHostRuntimeEnvironment(environment, manifest)
    .map((diagnostic) => diagnostic.code);
}

test("real self-host runtime keeps the public SDK URL separate from an internal gateway", () => {
  const manifest = createBuildEnvironmentManifest(createRealBuildEnvironment());
  assert.deepEqual(
    validateSelfHostRuntimeEnvironment(createRealRuntimeEnvironment(), manifest),
    [],
  );
});

test("real self-host runtime fails closed for missing server credentials", () => {
  const manifest = createBuildEnvironmentManifest(createRealBuildEnvironment());
  const environment: Record<string, string> = createRealRuntimeEnvironment();
  delete environment.SUPABASE_SERVICE_ROLE_KEY;

  assert.ok(
    diagnosticCodes(environment, manifest).includes("runtime_value_required"),
  );
});

test("Mattermost sender rotation accepts the active V2 key and rejects invalid key material", () => {
  const manifest = createBuildEnvironmentManifest(createRealBuildEnvironment());
  const v2Environment: Record<string, string> = createRealRuntimeEnvironment();
  delete v2Environment.MM_SENDER_CREDENTIALS_KEY_V1;
  v2Environment.MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION = "2";
  v2Environment.MM_SENDER_CREDENTIALS_KEY_V2 = senderKey;

  assert.deepEqual(validateSelfHostRuntimeEnvironment(v2Environment, manifest), []);
  v2Environment.MM_SENDER_CREDENTIALS_KEY_V2 = "not-a-32-byte-base64-key";
  assert.ok(
    diagnosticCodes(v2Environment, manifest).includes("mattermost_sender_key_invalid"),
  );
});

test("runtime public values must remain identical to the immutable build manifest", () => {
  const manifest = createBuildEnvironmentManifest(createRealBuildEnvironment());
  const environment = createRealRuntimeEnvironment();
  environment.NEXT_PUBLIC_SITE_URL = "https://different.example.invalid";

  assert.ok(
    diagnosticCodes(environment, manifest).includes("runtime_public_build_mismatch"),
  );
});

test("real runtime rejects a non-public SDK URL, public URL mismatch, and unsafe internal URL", () => {
  const manifest = createBuildEnvironmentManifest(createRealBuildEnvironment());
  const environment = createRealRuntimeEnvironment();

  environment.SUPABASE_URL = "http://gateway:8000";
  assert.ok(
    diagnosticCodes(environment, manifest).includes("public_supabase_url_invalid"),
  );
  assert.ok(
    diagnosticCodes(environment, manifest).includes(
      "runtime_supabase_public_url_mismatch",
    ),
  );

  environment.SUPABASE_URL = environment.NEXT_PUBLIC_SUPABASE_URL;
  environment.SUPABASE_INTERNAL_URL = "https://user:secret@gateway.test";
  assert.ok(
    diagnosticCodes(environment, manifest).includes(
      "internal_supabase_url_invalid",
    ),
  );
});

test("public build origins reject credentials and non-origin URL components", () => {
  const environment = createRealBuildEnvironment();
  environment.NEXT_PUBLIC_SUPABASE_URL = "https://user:secret@supabase.test";
  assert.throws(
    () => createBuildEnvironmentManifest(environment),
    /public_build_url_invalid:NEXT_PUBLIC_SUPABASE_URL/,
  );

  environment.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test/not-an-origin";
  assert.throws(
    () => createBuildEnvironmentManifest(environment),
    /public_build_url_invalid:NEXT_PUBLIC_SUPABASE_URL/,
  );
});

test("local mock mode is explicit, needs a mock-built image, and rejects mock auth", () => {
  const buildEnvironment = {
    NEXT_PUBLIC_DATA_SOURCE: "mock",
    NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "mock",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
  };
  const manifest = createBuildEnvironmentManifest(buildEnvironment);
  const safeLocalEnvironment = {
    ...buildEnvironment,
    SELF_HOST_MODE: "local-mock",
    MOCK_MEMBER_AUTH: "0",
  };

  assert.deepEqual(validateSelfHostRuntimeEnvironment(safeLocalEnvironment, manifest), []);
  assert.ok(
    diagnosticCodes(
      { ...safeLocalEnvironment, MOCK_MEMBER_AUTH: "1" },
      manifest,
    ).includes("mock_member_auth_forbidden"),
  );
});

test("real mode rejects mock authentication shortcuts", () => {
  const manifest = createBuildEnvironmentManifest(createRealBuildEnvironment());
  assert.ok(
    diagnosticCodes(
      { ...createRealRuntimeEnvironment(), MOCK_MEMBER_AUTH: "1" },
      manifest,
    ).includes("mock_member_auth_forbidden"),
  );
});

function createLocalDataEnvironment() {
  return [
    "POSTGRES_PASSWORD=database-secret-must-not-reach-the-app",
    "JWT_SECRET=jwt-secret-must-not-reach-the-app",
    "BACKUP_REPOSITORY_SECRET=backup-secret-must-not-reach-the-app",
    "SUPABASE_URL=http://127.0.0.1:58123",
    `SUPABASE_ANON_KEY=${secret}`,
    `SUPABASE_SERVICE_ROLE_KEY=${secret}-service-role`,
    "SUPABASE_INTERNAL_URL=http://gateway:8000",
  ].join("\n");
}

test("local runtime generator selects only app-safe Supabase values and writes a new owner-only file", async () => {
  const root = await mkdtemp(join(tmpdir(), "ssartnership-runtime-env-"));
  const dataDirectory = join(root, ".tmp", "self-host");
  const dataEnvFile = join(dataDirectory, "data.env");
  const outputFile = join(dataDirectory, "app.env");

  try {
    await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    await writeFile(dataEnvFile, createLocalDataEnvironment(), {
      encoding: "utf8",
      mode: 0o600,
    });
    const output = await writeLocalRuntimeEnvironment({
      dataEnvFile,
      outputFile,
      root,
    });
    const generated = Object.fromEntries(
      (await readFile(output, "utf8"))
        .trim()
        .split("\n")
        .map((line) => {
          const separator = line.indexOf("=");
          return [line.slice(0, separator), line.slice(separator + 1)];
        }),
    );

    assert.equal(output, outputFile);
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    assert.equal(generated.SUPABASE_URL, "http://127.0.0.1:58123");
    assert.equal(generated.NEXT_PUBLIC_SUPABASE_URL, generated.SUPABASE_URL);
    assert.equal(generated.SUPABASE_INTERNAL_URL, "http://gateway:8000");
    assert.equal(generated.MOCK_MEMBER_AUTH, "0");
    assert.equal(generated.NEXT_PUBLIC_SITE_URL, "http://127.0.0.1:3100");
    assert.equal(generated.MM_BASE_URL, "https://mattermost.test");
    for (const value of [
      "POSTGRES_PASSWORD",
      "JWT_SECRET",
      "BACKUP_REPOSITORY_SECRET",
      "database-secret-must-not-reach-the-app",
      "jwt-secret-must-not-reach-the-app",
      "backup-secret-must-not-reach-the-app",
    ]) {
      assert.ok(!JSON.stringify(generated).includes(value));
    }
    assert.equal(
      new Set([
        generated.ADMIN_SESSION_SECRET,
        generated.USER_SESSION_SECRET,
        generated.PARTNER_SESSION_SECRET,
        generated.CERTIFICATION_QR_SECRET,
        generated.MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET,
        generated.MEMBER_EMAIL_VERIFICATION_HMAC_SECRET,
        generated.GRADUATE_VERIFICATION_HMAC_SECRET,
        generated.CRON_SECRET,
      ]).size,
      8,
    );
    assert.deepEqual(
      validateSelfHostRuntimeEnvironment(
        generated,
        createBuildEnvironmentManifest(generated),
      ),
      [],
    );
    await assert.rejects(
      () => writeLocalRuntimeEnvironment({ dataEnvFile, outputFile, root }),
      /EEXIST/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local runtime generator refuses non-temporary and symbolic-link paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "ssartnership-runtime-env-"));
  const dataDirectory = join(root, ".tmp", "self-host");
  const dataEnvFile = join(dataDirectory, "data.env");
  const outsideFile = join(root, "outside.env");
  const symlinkOutput = join(dataDirectory, "app-link.env");

  try {
    await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    await writeFile(dataEnvFile, createLocalDataEnvironment(), "utf8");
    await writeFile(outsideFile, "outside", "utf8");
    await symlink(outsideFile, symlinkOutput);
    await assert.rejects(
      () =>
        writeLocalRuntimeEnvironment({
          dataEnvFile,
          outputFile: join(root, "deploy", "app.env"),
          root,
        }),
      /environment_path_not_temporary/u,
    );
    await assert.rejects(
      () =>
        writeLocalRuntimeEnvironment({
          dataEnvFile,
          outputFile: symlinkOutput,
          root,
        }),
      /environment_path_symlink_forbidden/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local runtime generator rejects non-local data endpoints", () => {
  assert.throws(
    () =>
      createLocalRuntimeEnvironment({
        SUPABASE_URL: "https://supabase.example.invalid",
        SUPABASE_ANON_KEY: secret,
        SUPABASE_SERVICE_ROLE_KEY: `${secret}-service-role`,
        SUPABASE_INTERNAL_URL: "http://gateway:8000",
      }),
    /data_env_public_supabase_url_invalid/u,
  );
  assert.throws(
    () =>
      createLocalRuntimeEnvironment({
        SUPABASE_URL: "http://127.0.0.1:58123",
        SUPABASE_ANON_KEY: secret,
        SUPABASE_SERVICE_ROLE_KEY: `${secret}-service-role`,
        SUPABASE_INTERNAL_URL: "http://db:5432",
      }),
    /data_env_internal_supabase_url_invalid/u,
  );
});

test("local runtime CLI writes only the requested temporary app environment and never prints a secret", async () => {
  const root = await mkdtemp(join(tmpdir(), "ssartnership-runtime-env-"));
  const dataDirectory = join(root, ".tmp", "self-host");
  const script = fileURLToPath(
    new URL("../deploy/self-host/write-local-runtime-env.mjs", import.meta.url),
  );

  try {
    await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
    await writeFile(join(dataDirectory, "data.env"), createLocalDataEnvironment(), "utf8");
    const { stderr, stdout } = await execFile(
      process.execPath,
      [
        script,
        "--data-env-file",
        ".tmp/self-host/data.env",
        "--output",
        ".tmp/self-host/app.env",
      ],
      { cwd: root },
    );

    assert.equal(stderr, "");
    assert.match(stdout, /Wrote local-only runtime environment: .*\.tmp\/self-host\/app\.env/u);
    assert.doesNotMatch(stdout, /database-secret|jwt-secret|backup-secret/u);
    assert.equal(
      (await stat(join(dataDirectory, "app.env"))).mode & 0o777,
      0o600,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("container files keep trusted installs, nonroot execution, image-only deployment, and a database-independent health route", () => {
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  const dockerignore = readFileSync(new URL("../.dockerignore", import.meta.url), "utf8");
  const compose = readFileSync(new URL("../compose.yaml", import.meta.url), "utf8");
  const localCompose = readFileSync(new URL("../compose.local.yaml", import.meta.url), "utf8");
  const startScript = readFileSync(
    new URL("../deploy/self-host/start.sh", import.meta.url),
    "utf8",
  );
  const healthRoute = readFileSync(
    new URL("../src/app/api/health/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(dockerfile, /node:24\.18\.1-bookworm-slim@sha256:/);
  assert.match(dockerfile, /RUN npm run install:trusted/);
  assert.doesNotMatch(dockerfile, /RUN npm\s+(?:ci|install)\b/);
  assert.match(dockerfile, /COPY scripts\/check-install-scripts\.mjs/);
  assert.match(dockerfile, /COPY vendor\/archiver-cjs-compat/);
  assert.match(dockerfile, /USER nextjs/);
  assert.match(startScript, /exec node \/app\/server\.js/);
  assert.match(dockerfile, /api\/health/);
  assert.match(dockerignore, /\.env\.\*/);
  assert.match(dockerignore, /\.git/);
  assert.match(dockerignore, /\*\.key/);
  assert.match(compose, /image: \$\{SELF_HOST_IMAGE/);
  assert.doesNotMatch(compose, /^\s*build:/m);
  assert.match(localCompose, /127\.0\.0\.1:3100:3000/);
  assert.match(localCompose, /SELF_HOST_MODE: local-mock/);
  assert.match(localCompose, /env_file: !reset \[\]/);
  assert.match(localCompose, /MOCK_MEMBER_AUTH: "0"/);
  assert.match(healthRoute, /\{ status: "ok" \}/);
  assert.doesNotMatch(healthRoute, /SUPABASE|repository|fetch\(/);
});
