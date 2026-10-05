// Guards for supabase/schema.sql. The migrations are the single source of
// truth; schema.sql is a derived, replay-ordered snapshot that must not drift
// from their final state in ways a reader (or a source-contract test) relies on.

const TYPE_ALIASES = new Map([
  ["timestamptz", "timestamp with time zone"],
  ["int", "integer"],
  ["int4", "integer"],
  ["int8", "bigint"],
  ["int2", "smallint"],
  ["bool", "boolean"],
  ["varchar", "character varying"],
]);

const TYPE_KEYWORDS = new Set([
  "bigint", "boolean", "bytea", "character", "date", "double", "inet", "integer",
  "interval", "json", "jsonb", "name", "numeric", "real", "record", "regclass",
  "smallint", "text", "time", "timestamp", "uuid", "anyelement", "varchar",
  ...TYPE_ALIASES.keys(),
]);

export function stripSqlLineComments(sql) {
  return sql.replace(/--[^\n]*/gu, "");
}

function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/** Normalizes one parameter declaration to its identity type, or null for OUT parameters. */
export function normalizeParameterType(declaration) {
  const withoutDefault = declaration.trim().split(/\s+default\s+|\s*:=\s*|\s*=\s*/iu)[0];
  let tokens = withoutDefault.toLowerCase().replace(/\s+\[/gu, "[").split(/\s+/u).filter(Boolean);
  if (["in", "out", "inout", "variadic"].includes(tokens[0])) {
    if (tokens[0] === "out") return null;
    tokens = tokens.slice(1);
  }
  const head = tokens[0]?.replace(/\[\]$/u, "") ?? "";
  if (tokens.length > 1 && !TYPE_KEYWORDS.has(head) && !head.startsWith("public.")) {
    tokens = tokens.slice(1);
  }
  const type = tokens.join(" ").replace(/^public\./u, "");
  return TYPE_ALIASES.get(type) ?? type;
}

/** Replays create/drop function statements and returns name -> identity signatures. */
export function collectFunctionSignatures(sources) {
  const signatures = new Map();
  const pattern = /\b(create\s+(?:or\s+replace\s+)?function|drop\s+function\s+(?:if\s+exists\s+)?)\s*(?:public\.)?([a-z_][a-z0-9_]*)\s*\(/giu;
  for (const source of sources) {
    const sql = stripSqlLineComments(source);
    for (const match of sql.matchAll(pattern)) {
      let index = match.index + match[0].length;
      let depth = 1;
      while (depth > 0 && index < sql.length) {
        if (sql[index] === "(") depth += 1;
        else if (sql[index] === ")") depth -= 1;
        index += 1;
      }
      const args = sql.slice(match.index + match[0].length, index - 1);
      const signature = splitTopLevel(args)
        .map(normalizeParameterType)
        .filter((type) => type !== null)
        .join(", ");
      const name = match[2].toLowerCase();
      const known = signatures.get(name) ?? new Set();
      if (/^drop/iu.test(match[1])) known.delete(signature);
      else known.add(signature);
      signatures.set(name, known);
    }
  }
  return signatures;
}

/** Lists functions whose final identity signatures differ between migrations and schema.sql. */
export function compareFunctionSignatures(migrationSources, schemaSql) {
  const expected = collectFunctionSignatures(migrationSources);
  const actual = collectFunctionSignatures([schemaSql]);
  const drift = [];
  for (const name of [...new Set([...expected.keys(), ...actual.keys()])].sort()) {
    const want = [...(expected.get(name) ?? [])].sort();
    const have = [...(actual.get(name) ?? [])].sort();
    if (want.join("|") !== have.join("|")) drift.push({ name, migrations: want, schema: have });
  }
  return drift;
}

/** Columns dropped by the migrations and not re-added later, keyed by table. */
export function collectDroppedColumns(migrationSources) {
  const dropped = new Map();
  for (const source of migrationSources) {
    const sql = stripSqlLineComments(source);
    for (const statement of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+([^;]*);/giu)) {
      const table = statement[1].toLowerCase();
      const columns = dropped.get(table) ?? new Set();
      for (const drop of statement[2].matchAll(/drop\s+column\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)/giu)) columns.add(drop[1].toLowerCase());
      for (const add of statement[2].matchAll(/add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/giu)) columns.delete(add[1].toLowerCase());
      if (columns.size > 0) dropped.set(table, columns);
    }
    for (const drop of sql.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/giu)) dropped.delete(drop[1].toLowerCase());
  }
  return dropped;
}

/** Index definitions in schema.sql that still reference a column the final schema dropped. */
export function findDroppedColumnIndexes(schemaSql, droppedColumns) {
  const sql = stripSqlLineComments(schemaSql);
  const findings = [];
  const pattern = /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s+on\s+(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*(?:using\s+\w+\s*)?\(([^;]*)\)\s*(?:where\s+([^;]*))?;/giu;
  for (const match of sql.matchAll(pattern)) {
    const columns = droppedColumns.get(match[2].toLowerCase());
    if (!columns) continue;
    const identifiers = new Set(`${match[3]} ${match[4] ?? ""}`.toLowerCase().match(/[a-z_][a-z0-9_]*/gu) ?? []);
    const stale = [...columns].filter((column) => identifiers.has(column));
    if (stale.length > 0) findings.push({ index: match[1], table: match[2].toLowerCase(), columns: stale });
  }
  return findings;
}

const INDEX_STATEMENT_PATTERN = new RegExp([
  /create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s+on\s+(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*(?:using\s+\w+\s*)?\(([^;]*)\)[^;]*;/u.source,
  /drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/u.source,
  /drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/u.source,
  /alter\s+index\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+rename\s+to\s+([a-z_][a-z0-9_]*)/u.source,
].join("|"), "giu");

/** Replays create/drop/rename index and drop table statements; returns index name -> { table, definition }. */
export function collectIndexes(sources) {
  const indexes = new Map();
  for (const source of sources) {
    const sql = stripSqlLineComments(source);
    for (const match of sql.matchAll(INDEX_STATEMENT_PATTERN)) {
      if (match[1]) {
        indexes.set(match[1].toLowerCase(), { table: match[2].toLowerCase(), definition: match[3].toLowerCase() });
      } else if (match[4]) {
        indexes.delete(match[4].toLowerCase());
      } else if (match[5]) {
        const table = match[5].toLowerCase();
        for (const [name, index] of indexes) if (index.table === table) indexes.delete(name);
      } else if (match[6]) {
        const index = indexes.get(match[6].toLowerCase());
        if (index) {
          indexes.delete(match[6].toLowerCase());
          indexes.set(match[7].toLowerCase(), index);
        }
      }
    }
  }
  return indexes;
}

/**
 * Indexes the migrations leave in place that schema.sql never creates. Indexes
 * on a column the migrations dropped are skipped (Postgres drops them with the
 * column). The reverse direction is not checked: schema.sql still carries
 * pre-migration baseline indexes that no migration created.
 */
export function findMissingIndexes(migrationSources, schemaSql) {
  const droppedColumns = collectDroppedColumns(migrationSources);
  const snapshot = collectIndexes([schemaSql]);
  const missing = [];
  for (const [name, index] of collectIndexes(migrationSources)) {
    const dropped = droppedColumns.get(index.table);
    const identifiers = new Set(index.definition.match(/[a-z_][a-z0-9_]*/gu) ?? []);
    if (dropped && [...dropped].some((column) => identifiers.has(column))) continue;
    if (!snapshot.has(name)) missing.push({ index: name, table: index.table });
  }
  return missing.sort((left, right) => left.index.localeCompare(right.index));
}

/** Line numbers of statements that end with a trailing comma before the closing parenthesis. */
export function findTrailingCommaStatements(schemaSql) {
  const sql = stripSqlLineComments(schemaSql);
  return [...sql.matchAll(/,\s*\n\s*\)\s*;/gu)].map((match) => sql.slice(0, match.index).split("\n").length);
}

export function checkSchemaSnapshot(migrationSources, schemaSql) {
  return {
    signatureDrift: compareFunctionSignatures(migrationSources, schemaSql),
    droppedColumnIndexes: findDroppedColumnIndexes(schemaSql, collectDroppedColumns(migrationSources)),
    missingIndexes: findMissingIndexes(migrationSources, schemaSql),
    trailingCommaLines: findTrailingCommaStatements(schemaSql),
  };
}
