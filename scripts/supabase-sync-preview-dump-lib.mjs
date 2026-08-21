const POSTGRES_CONNECTION_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const POSTGRES_ENVIRONMENT_NAMES = [
  "PGHOST",
  "PGPORT",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
  "PGSSLMODE",
  "PGOPTIONS",
  "PGAPPNAME",
];

// This is the PostgreSQL 17 client image pulled by Supabase CLI 2.114.0 in
// Preview Sync. Pinning its manifest keeps the direct dump path reproducible.
export const SUPABASE_POSTGRES_DUMP_IMAGE =
  "ghcr.io/supabase/postgres@sha256:99b1729aeb0bac314445024fc149fbd39306170b61dd50800ccf180327ab3459";

const CIRCULAR_FOREIGN_KEY_WARNING_HEADER =
  /^pg_dump: warning: .*circular foreign-key constraints/u;
const CIRCULAR_FOREIGN_KEY_WARNING_DETAIL = /^pg_dump: detail: /u;
const CIRCULAR_FOREIGN_KEY_WARNING_HINT =
  /^pg_dump: hint: .*--disable-triggers/u;

function removeLineEnding(line) {
  return line.replace(/\r?\n$/u, "");
}

/**
 * Removes only the complete pg_dump circular-FK advisory that is already
 * handled by the dump's --disable-triggers/session-replica restore contract.
 * Any partial or unfamiliar diagnostic is kept verbatim so Preview Sync stays
 * fail-closed for new dump errors and warnings.
 */
export function filterPgDumpCircularForeignKeyWarnings(stderr) {
  const output = [];
  let pendingWarning = null;

  for (const line of stderr.split(/(?<=\n)/u)) {
    const normalizedLine = removeLineEnding(line);

    if (CIRCULAR_FOREIGN_KEY_WARNING_HEADER.test(normalizedLine)) {
      if (pendingWarning) {
        output.push(...pendingWarning.lines);
      }
      pendingWarning = { detailCount: 0, lines: [line] };
      continue;
    }

    if (pendingWarning) {
      pendingWarning.lines.push(line);
      if (CIRCULAR_FOREIGN_KEY_WARNING_DETAIL.test(normalizedLine)) {
        pendingWarning.detailCount += 1;
        continue;
      }
      if (
        pendingWarning.detailCount > 0 &&
        CIRCULAR_FOREIGN_KEY_WARNING_HINT.test(normalizedLine)
      ) {
        pendingWarning = null;
        continue;
      }

      output.push(...pendingWarning.lines);
      pendingWarning = null;
      continue;
    }

    output.push(line);
  }

  if (pendingWarning) {
    output.push(...pendingWarning.lines);
  }

  return output.join("");
}

function decodeConnectionComponent(value, name) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error(`${name} must be valid percent-encoded text.`);
  }
}

function requiredConnectionComponent(value, name) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Production database URL must include ${name}.`);
  }
  return normalized;
}

function quoteShellValue(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function assertSafeTableName(table) {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
    throw new Error(`Unsupported Preview Sync table name: ${table}`);
  }
}

export function parsePostgresConnectionForContainer(databaseUrl) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("SUPABASE_PRODUCTION_DB_URL must be a valid PostgreSQL URL.");
  }

  if (!POSTGRES_CONNECTION_PROTOCOLS.has(url.protocol)) {
    throw new Error("SUPABASE_PRODUCTION_DB_URL must use postgres or postgresql.");
  }

  const database = decodeConnectionComponent(url.pathname.replace(/^\//, ""), "database");
  const environment = {
    PGHOST: requiredConnectionComponent(url.hostname, "host"),
    PGPORT: url.port || "5432",
    PGUSER: requiredConnectionComponent(
      decodeConnectionComponent(url.username, "username"),
      "username",
    ),
    PGPASSWORD: requiredConnectionComponent(
      decodeConnectionComponent(url.password, "password"),
      "password",
    ),
    PGDATABASE: requiredConnectionComponent(database, "database"),
  };

  const optionalQueryEnvironment = [
    ["sslmode", "PGSSLMODE"],
    ["options", "PGOPTIONS"],
    ["application_name", "PGAPPNAME"],
  ];
  for (const [queryName, environmentName] of optionalQueryEnvironment) {
    const value = url.searchParams.get(queryName)?.trim();
    if (value) {
      environment[environmentName] = value;
    }
  }

  return environment;
}

export function buildProductionDataDumpContainerPlan({
  productionDbUrl,
  schema,
  excludedTables,
}) {
  if (schema !== "public") {
    throw new Error("Preview Sync only supports the public schema data dump.");
  }

  const environment = parsePostgresConnectionForContainer(productionDbUrl);
  const excludedTableFlags = excludedTables.map((table) => {
    assertSafeTableName(table);
    return `    --exclude-table ${quoteShellValue(`"${schema}"."${table}"`)} \\`;
  });
  const dumpScript = [
    "set -euo pipefail",
    "{",
    "  printf 'SET session_replication_role = replica;\\n\\n'",
    "  pg_dump \\",
    "    --data-only \\",
    "    --disable-triggers \\",
    "    --quote-all-identifiers \\",
    "    --role postgres \\",
    `    --schema ${quoteShellValue(schema)} \\`,
    ...excludedTableFlags,
    "  | sed -E 's/^\\\\(un)?restrict .*$/-- &/'",
    "  printf '\\nRESET ALL;\\n'",
    "}",
  ].join("\n");
  const environmentNames = POSTGRES_ENVIRONMENT_NAMES.filter((name) => name in environment);

  return {
    command: "docker",
    args: [
      "run",
      "--rm",
      "--network",
      "host",
      ...environmentNames.flatMap((name) => ["--env", name]),
      // The pinned Supabase Postgres image has a database-server entrypoint.
      // Override it so the dump script runs as the client shell that the CLI uses.
      "--entrypoint",
      "bash",
      SUPABASE_POSTGRES_DUMP_IMAGE,
      "-c",
      dumpScript,
    ],
    environment,
  };
}
