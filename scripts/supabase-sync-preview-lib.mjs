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

const CAMPUS_SLUGS = [
  "seoul",
  "gumi",
  "daejeon",
  "busan-ulsan-gyeongnam",
  "gwangju",
];

function inferCampusSlugsFromLocation(location) {
  const normalized = location.trim();
  if (!normalized) {
    return CAMPUS_SLUGS;
  }
  if (/전국|전\s*지점|전체\s*지점|모든\s*지점|전\s*매장|전체\s*매장|모든\s*매장/.test(normalized)) {
    return CAMPUS_SLUGS;
  }

  const slugs = [
    /서울|강남|역삼|역삼역|선릉|테헤란|봉은사|논현/.test(normalized)
      ? "seoul"
      : null,
    /구미|경북|경상북도/.test(normalized) ? "gumi" : null,
    /대전|유성|둔산/.test(normalized) ? "daejeon" : null,
    /부산|울산|경남|창원|김해|양산|해운대|서면/.test(normalized)
      ? "busan-ulsan-gyeongnam"
      : null,
    /광주|전남/.test(normalized) ? "gwangju" : null,
  ].filter(Boolean);

  return slugs.length > 0 ? slugs : CAMPUS_SLUGS;
}

function buildPostgresTextArray(values) {
  return `{${values.join(",")}}`;
}

function transformKeptValuesForPreview(table, columns, values) {
  if (table !== "partners") {
    return {
      values,
      changed: false,
    };
  }

  const locationIndex = columns.indexOf("location");
  const campusSlugsIndex = columns.indexOf("campus_slugs");
  if (locationIndex < 0 || campusSlugsIndex < 0) {
    return {
      values,
      changed: false,
    };
  }

  const currentCampusSlugs = values[campusSlugsIndex]?.trim() ?? "";
  if (currentCampusSlugs && currentCampusSlugs !== "\\N" && currentCampusSlugs !== "{}") {
    return {
      values,
      changed: false,
    };
  }

  const nextValues = [...values];
  nextValues[campusSlugsIndex] = buildPostgresTextArray(
    inferCampusSlugsFromLocation(values[locationIndex] ?? ""),
  );

  return {
    values: nextValues,
    changed: true,
  };
}

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

    const mayTransformValues =
      copyStatement.table === "partners" &&
      copyStatement.columns.includes("location") &&
      copyStatement.columns.includes("campus_slugs");

    if (keptIndexes.length === copyStatement.columns.length && !mayTransformValues) {
      output.push(line);
      continue;
    }

    const keptColumns = keptIndexes.map((columnIndex) => copyStatement.columns[columnIndex]);
    const statementLine =
      keptIndexes.length === copyStatement.columns.length
        ? line
        : buildCopyStatement(copyStatement.schema, copyStatement.table, keptColumns);
    output.push(statementLine);
    if (keptIndexes.length !== copyStatement.columns.length) {
      changed = true;
    }

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
        const keptValues = keptIndexes.map((columnIndex) => values[columnIndex]);
        const transformed = transformKeptValuesForPreview(
          copyStatement.table,
          keptColumns,
          keptValues,
        );
        if (transformed.changed) {
          changed = true;
        }
        output.push(transformed.values.join("\t"));
      }
      index += 1;
    }
  }

  return {
    sql: output.join("\n"),
    changed,
  };
}
