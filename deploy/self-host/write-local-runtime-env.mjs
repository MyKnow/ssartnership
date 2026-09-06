import { randomBytes } from "node:crypto";
import { lstat, mkdir, open, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, relative, resolve, sep } from "node:path";

import {
  createBuildEnvironmentManifest,
  validateSelfHostRuntimeEnvironment,
} from "./runtime-env.mjs";

const DATA_ENVIRONMENT_NAMES = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_INTERNAL_URL",
];

const RUNTIME_ENVIRONMENT_NAMES = [
  "NEXT_PUBLIC_DATA_SOURCE",
  "NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "SELF_HOST_MODE",
  "MOCK_MEMBER_AUTH",
  ...DATA_ENVIRONMENT_NAMES,
  "ADMIN_SESSION_SECRET",
  "USER_SESSION_SECRET",
  "PARTNER_SESSION_SECRET",
  "CERTIFICATION_QR_SECRET",
  "MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET",
  "MEMBER_EMAIL_VERIFICATION_HMAC_SECRET",
  "GRADUATE_VERIFICATION_HMAC_SECRET",
  "MM_BASE_URL",
  "MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION",
  "MM_SENDER_CREDENTIALS_KEY_V1",
  "CRON_SECRET",
];

const LOCAL_PUBLIC_SUPABASE_URL = /^http:\/\/127\.0\.0\.1:([1-9]\d{3,4})$/u;
const LOCAL_INTERNAL_SUPABASE_URL = "http://gateway:8000";
const LOCAL_SITE_URL = "http://127.0.0.1:3100";

function configurationError(code) {
  return new Error(`local self-host runtime configuration error: ${code}`);
}

function parseDataEnvironment(text) {
  const environment = {};
  for (const rawLine of text.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (
      separator < 1
      || !/^[A-Z][A-Z0-9_]*$/u.test(name)
      || Object.hasOwn(environment, name)
    ) {
      throw configurationError("data_env_key_invalid");
    }
    if (!value || /[\u0000-\u001F\u007F]/u.test(value)) {
      throw configurationError("data_env_value_invalid");
    }
    environment[name] = value;
  }
  return environment;
}

function readRequiredDataValue(environment, name) {
  const value = environment[name];
  if (typeof value !== "string" || !value) {
    throw configurationError(`data_env_value_required:${name}`);
  }
  return value;
}

function validateLocalDataEnvironment(environment) {
  const selected = Object.fromEntries(
    DATA_ENVIRONMENT_NAMES.map((name) => [
      name,
      readRequiredDataValue(environment, name),
    ]),
  );
  const match = LOCAL_PUBLIC_SUPABASE_URL.exec(selected.SUPABASE_URL);
  const port = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(port) || port < 1_024 || port > 65_535) {
    throw configurationError("data_env_public_supabase_url_invalid");
  }
  if (selected.SUPABASE_INTERNAL_URL !== LOCAL_INTERNAL_SUPABASE_URL) {
    throw configurationError("data_env_internal_supabase_url_invalid");
  }
  return selected;
}

function createRuntimeSecret() {
  return randomBytes(48).toString("base64url");
}

/**
 * Builds an application-only local runtime environment from selected Supabase
 * connection values. Database, JWT, and backup settings are never copied.
 */
export function createLocalRuntimeEnvironment(dataEnvironment) {
  const data = validateLocalDataEnvironment(dataEnvironment);
  const publicEnvironment = {
    NEXT_PUBLIC_DATA_SOURCE: "supabase",
    NEXT_PUBLIC_PARTNER_PORTAL_DATA_SOURCE: "supabase",
    NEXT_PUBLIC_SUPABASE_URL: data.SUPABASE_URL,
    NEXT_PUBLIC_SITE_URL: LOCAL_SITE_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "",
  };
  const runtimeEnvironment = {
    ...publicEnvironment,
    SELF_HOST_MODE: "real",
    MOCK_MEMBER_AUTH: "0",
    ...data,
    ADMIN_SESSION_SECRET: createRuntimeSecret(),
    USER_SESSION_SECRET: createRuntimeSecret(),
    PARTNER_SESSION_SECRET: createRuntimeSecret(),
    CERTIFICATION_QR_SECRET: createRuntimeSecret(),
    MEMBER_IDENTIFIER_RESERVATION_HMAC_SECRET: createRuntimeSecret(),
    MEMBER_EMAIL_VERIFICATION_HMAC_SECRET: createRuntimeSecret(),
    GRADUATE_VERIFICATION_HMAC_SECRET: createRuntimeSecret(),
    MM_BASE_URL: "https://mattermost.test",
    MM_SENDER_CREDENTIALS_ACTIVE_KEY_VERSION: "1",
    MM_SENDER_CREDENTIALS_KEY_V1: randomBytes(32).toString("base64"),
    CRON_SECRET: createRuntimeSecret(),
  };
  const diagnostics = validateSelfHostRuntimeEnvironment(
    runtimeEnvironment,
    createBuildEnvironmentManifest(publicEnvironment),
  );
  if (diagnostics.length > 0) {
    throw configurationError("generated_runtime_invalid");
  }
  return runtimeEnvironment;
}

function renderRuntimeEnvironment(environment) {
  return `${RUNTIME_ENVIRONMENT_NAMES.map(
    (name) => `${name}=${environment[name]}`,
  ).join("\n")}\n`;
}

function assertTemporaryPath(file, root) {
  const resolvedRoot = resolve(root);
  const resolvedFile = resolve(resolvedRoot, file);
  const path = relative(resolvedRoot, resolvedFile);
  if (
    !path
    || path === ".tmp"
    || path === ".."
    || path.startsWith(`..${sep}`)
    || !path.startsWith(`.tmp${sep}`)
  ) {
    throw configurationError("environment_path_not_temporary");
  }
  return { resolvedFile, resolvedRoot };
}

async function assertNoSymlinkPath(root, destination) {
  const rootMetadata = await lstat(root);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    throw configurationError("environment_path_symlink_forbidden");
  }
  const relativePath = relative(root, destination);
  const segments = relativePath.split(sep).filter(Boolean);
  let current = root;
  for (const segment of segments) {
    current = resolve(current, segment);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) {
        throw configurationError("environment_path_symlink_forbidden");
      }
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        return;
      }
      throw error;
    }
  }
}

async function assertSafeInputPath(file, root) {
  const { resolvedFile, resolvedRoot } = assertTemporaryPath(file, root);
  await assertNoSymlinkPath(resolvedRoot, resolvedFile);
  const metadata = await lstat(resolvedFile);
  if (!metadata.isFile()) {
    throw configurationError("data_env_file_invalid");
  }
  return resolvedFile;
}

async function writeNewRuntimeEnvironment(file, environment, root) {
  const { resolvedFile, resolvedRoot } = assertTemporaryPath(file, root);
  await assertNoSymlinkPath(resolvedRoot, dirname(resolvedFile));
  await mkdir(dirname(resolvedFile), { recursive: true, mode: 0o700 });
  await assertNoSymlinkPath(resolvedRoot, resolvedFile);

  const handle = await open(resolvedFile, "wx", 0o600);
  try {
    await handle.writeFile(renderRuntimeEnvironment(environment), "utf8");
  } finally {
    await handle.close();
  }

  if (((await stat(resolvedFile)).mode & 0o777) !== 0o600) {
    throw configurationError("environment_output_mode_invalid");
  }
  return resolvedFile;
}

export async function writeLocalRuntimeEnvironment({
  dataEnvFile,
  outputFile,
  root = process.cwd(),
}) {
  const input = await assertSafeInputPath(dataEnvFile, root);
  const dataEnvironment = parseDataEnvironment(await readFile(input, "utf8"));
  return writeNewRuntimeEnvironment(
    outputFile,
    createLocalRuntimeEnvironment(dataEnvironment),
    root,
  );
}

function parseCliArguments(argumentsList) {
  if (argumentsList.length !== 4) {
    throw configurationError("cli_arguments_invalid");
  }

  const values = new Map();
  for (let index = 0; index < argumentsList.length; index += 2) {
    const option = argumentsList[index];
    const value = argumentsList[index + 1];
    if (
      (option !== "--data-env-file" && option !== "--output")
      || !value
      || values.has(option)
    ) {
      throw configurationError("cli_arguments_invalid");
    }
    values.set(option, value);
  }

  return {
    dataEnvFile: values.get("--data-env-file"),
    outputFile: values.get("--output"),
  };
}

async function main() {
  const output = await writeLocalRuntimeEnvironment(parseCliArguments(process.argv.slice(2)));
  process.stdout.write(
    `Wrote local-only runtime environment: ${output}\nDo not commit or expose this file.\n`,
  );
}

if (
  process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "local runtime environment generation failed"}\n`,
    );
    process.exitCode = 1;
  });
}
