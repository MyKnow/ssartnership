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
