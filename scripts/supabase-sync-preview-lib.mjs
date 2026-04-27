function splitQualifiedName(value) {
  const parts = [];
  let current = "";
  let inQuotes = false;

  for (const char of value) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (char === "." && !inQuotes) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function stripIdentifierQuotes(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

const DEFAULT_EXCLUDED_COPY_COLUMNS_BY_TABLE = new Map([
  [
    "members",
    new Set([
      "avatar_base64",
      "password_hash",
      "password_salt",
    ]),
  ],
]);

export function parseCopyStatement(line) {
  const match = line.match(/^COPY\s+(.+?)\s+\((.+)\)\s+FROM\s+stdin;$/);
  if (!match) {
    return null;
  }

  const [, qualifiedName, rawColumns] = match;
  const nameParts = splitQualifiedName(qualifiedName);
  if (nameParts.length !== 2) {
    return null;
  }

  return {
    schema: stripIdentifierQuotes(nameParts[0]),
    table: stripIdentifierQuotes(nameParts[1]),
    columns: rawColumns.split(",").map((column) => stripIdentifierQuotes(column)),
  };
}

export function buildCopyStatement(schema, table, columns) {
  return `COPY ${quoteIdentifier(schema)}.${quoteIdentifier(table)} (${columns
    .map((column) => quoteIdentifier(column))
    .join(", ")}) FROM stdin;`;
}

export function sanitizeDumpSqlForPreview(
  sql,
  previewColumnsByTable,
  excludedColumnsByTable = DEFAULT_EXCLUDED_COPY_COLUMNS_BY_TABLE,
) {
  const lines = sql.split("\n");
  const output = [];
  let changed = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const copyStatement = parseCopyStatement(line);

    if (!copyStatement || copyStatement.schema !== "public") {
      output.push(line);
      continue;
    }

    const previewColumns = previewColumnsByTable.get(copyStatement.table);
    if (!previewColumns) {
      output.push(line);
      continue;
    }

    const excludedColumns = excludedColumnsByTable.get(copyStatement.table) ?? new Set();
    const keptIndexes = copyStatement.columns
      .map((column, columnIndex) =>
        previewColumns.has(column) && !excludedColumns.has(column) ? columnIndex : -1,
      )
      .filter((columnIndex) => columnIndex >= 0);

    if (keptIndexes.length === copyStatement.columns.length) {
      output.push(line);
      continue;
    }

    changed = true;
    const keptColumns = keptIndexes.map((columnIndex) => copyStatement.columns[columnIndex]);
    output.push(buildCopyStatement(copyStatement.schema, copyStatement.table, keptColumns));

    index += 1;
    while (index < lines.length) {
      const dataLine = lines[index];
      if (dataLine === "\\.") {
        output.push(dataLine);
        break;
      }

      const values = dataLine.split("\t");
      if (values.length !== copyStatement.columns.length) {
        output.push(dataLine);
      } else {
        output.push(keptIndexes.map((columnIndex) => values[columnIndex]).join("\t"));
      }
      index += 1;
    }
  }

  return {
    sql: output.join("\n"),
    changed,
  };
}
