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

const CAMPUS_SCOPE_RULES = {
  partners: {
    locationColumns: ["location"],
    campusColumns: ["campus_slugs"],
  },
  partner_change_requests: {
    locationColumns: ["current_partner_location", "requested_partner_location"],
    campusColumns: ["current_campus_slugs", "requested_campus_slugs"],
  },
};

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

function isValidCampusSlugsValue(value) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed === "\\N" || trimmed === "{}") {
    return false;
  }
  const match = trimmed.match(/^\{(.+)\}$/);
  if (!match) {
    return false;
  }
  const values = match[1].split(",").map((item) => item.trim()).filter(Boolean);
  return values.length > 0 && values.every((item) => CAMPUS_SLUGS.includes(item));
}

function createSanitizeStats() {
  return {
    copyBlocksChanged: 0,
    partnerCopyBlocksSeen: 0,
    partnerRowsSeen: 0,
    partnerCampusSlugsAppended: 0,
    partnerCampusSlugsBackfilled: 0,
    partnerRowsSkippedColumnMismatch: 0,
    unresolvedPartnerCampusSlugRows: 0,
    partnerChangeRequestCopyBlocksSeen: 0,
    partnerChangeRequestRowsSeen: 0,
    partnerChangeRequestCampusSlugsAppended: 0,
    partnerChangeRequestCampusSlugsBackfilled: 0,
    partnerChangeRequestRowsSkippedColumnMismatch: 0,
    unresolvedPartnerChangeRequestCampusSlugRows: 0,
  };
}

function getCampusScopeRule(table) {
  return CAMPUS_SCOPE_RULES[table] ?? null;
}

function getStatsPrefixForTable(table) {
  if (table === "partners") {
    return "partner";
  }
  if (table === "partner_change_requests") {
    return "partnerChangeRequest";
  }
  return null;
}

function recordCampusScopeTransformation(stats, table, reason) {
  const prefix = getStatsPrefixForTable(table);
  if (!prefix || !reason) {
    return;
  }

  if (reason === "appended") {
    stats[`${prefix}CampusSlugsAppended`] += 1;
  }

  if (reason === "backfilled") {
    stats[`${prefix}CampusSlugsBackfilled`] += 1;
  }
}

function transformKeptValuesForPreview(table, columns, values) {
  const rule = getCampusScopeRule(table);
  if (!rule) {
    return {
      values,
      changed: false,
      reason: null,
    };
  }

  const nextValues = [...values];
  let changed = false;
  let appendedCount = 0;
  let backfilledCount = 0;

  for (let index = 0; index < rule.campusColumns.length; index += 1) {
    const campusColumn = rule.campusColumns[index];
    const locationColumn = rule.locationColumns[index];
    const campusSlugsIndex = columns.indexOf(campusColumn);
    const locationIndex = columns.indexOf(locationColumn);
    const inferredValue = buildPostgresTextArray(
      inferCampusSlugsFromLocation(locationIndex >= 0 ? values[locationIndex] ?? "" : ""),
    );

    if (campusSlugsIndex < 0) {
      nextValues.push(inferredValue);
      changed = true;
      appendedCount += 1;
      continue;
    }

    if (campusSlugsIndex >= values.length) {
      nextValues[campusSlugsIndex] = inferredValue;
      changed = true;
      appendedCount += 1;
      continue;
    }

    const currentCampusSlugs = values[campusSlugsIndex]?.trim() ?? "";
    if (isValidCampusSlugsValue(currentCampusSlugs)) {
      continue;
    }

    nextValues[campusSlugsIndex] = inferredValue;
    changed = true;
    backfilledCount += 1;
  }

  if (!changed) {
    return {
      values,
      changed: false,
      reason: null,
    };
  }

  return {
    values: nextValues,
    changed: true,
    reason:
      appendedCount > 0 && backfilledCount > 0
        ? "mixed"
        : appendedCount > 0
          ? "appended"
          : "backfilled",
  };
}

function hasUnresolvedPartnerCampusSlugs(table, columns, values) {
  const rule = getCampusScopeRule(table);
  if (!rule) {
    return false;
  }

  for (const campusColumn of rule.campusColumns) {
    const campusSlugsIndex = columns.indexOf(campusColumn);
    if (campusSlugsIndex < 0) {
      return true;
    }
    if (!isValidCampusSlugsValue(values[campusSlugsIndex])) {
      return true;
    }
  }

  return false;
}

function copyStats(stats) {
  return {
    ...stats,
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
  const stats = createSanitizeStats();
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

    const isPartnerCopyBlock = copyStatement.table === "partners";
    const isPartnerChangeRequestCopyBlock = copyStatement.table === "partner_change_requests";
    if (isPartnerCopyBlock) {
      stats.partnerCopyBlocksSeen += 1;
    }
    if (isPartnerChangeRequestCopyBlock) {
      stats.partnerChangeRequestCopyBlocksSeen += 1;
    }

    const excludedColumns = excludedColumnsByTable.get(copyStatement.table) ?? new Set();
    const keptIndexes = copyStatement.columns
      .map((column, columnIndex) =>
        previewColumns.has(column) && !excludedColumns.has(column) ? columnIndex : -1,
      )
      .filter((columnIndex) => columnIndex >= 0);

    const rule = getCampusScopeRule(copyStatement.table);
    const shouldAppendCampusScopeColumns =
      rule &&
      rule.campusColumns.every((campusColumn) => previewColumns.has(campusColumn)) &&
      rule.locationColumns.every((locationColumn) => copyStatement.columns.includes(locationColumn)) &&
      rule.campusColumns.some((campusColumn) => !copyStatement.columns.includes(campusColumn));
    const mayTransformValues =
      Boolean(rule) &&
      rule.campusColumns.every((campusColumn) => previewColumns.has(campusColumn)) &&
      (rule.campusColumns.some((campusColumn) => copyStatement.columns.includes(campusColumn)) ||
        shouldAppendCampusScopeColumns);

    if (keptIndexes.length === copyStatement.columns.length && !mayTransformValues) {
      output.push(line);
      continue;
    }

    const keptColumns = keptIndexes.map((columnIndex) => copyStatement.columns[columnIndex]);
    const outputColumns = shouldAppendCampusScopeColumns
      ? [
          ...keptColumns,
          ...rule.campusColumns.filter((campusColumn) => !keptColumns.includes(campusColumn)),
        ]
      : keptColumns;
    const statementLine =
      keptIndexes.length === copyStatement.columns.length && !shouldAppendCampusScopeColumns
        ? line
        : buildCopyStatement(copyStatement.schema, copyStatement.table, outputColumns);
    output.push(statementLine);
    if (keptIndexes.length !== copyStatement.columns.length || shouldAppendCampusScopeColumns) {
      stats.copyBlocksChanged += 1;
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
      if (isPartnerCopyBlock) {
        stats.partnerRowsSeen += 1;
      }
      if (isPartnerChangeRequestCopyBlock) {
        stats.partnerChangeRequestRowsSeen += 1;
      }

      if (values.length !== copyStatement.columns.length) {
        if (isPartnerCopyBlock) {
          stats.partnerRowsSkippedColumnMismatch += 1;
          stats.unresolvedPartnerCampusSlugRows += 1;
        }
        if (isPartnerChangeRequestCopyBlock) {
          stats.partnerChangeRequestRowsSkippedColumnMismatch += 1;
          stats.unresolvedPartnerChangeRequestCampusSlugRows += 1;
        }
        output.push(dataLine);
      } else {
        const keptValues = keptIndexes.map((columnIndex) => values[columnIndex]);
        const transformed = transformKeptValuesForPreview(
          copyStatement.table,
          outputColumns,
          keptValues,
        );
        if (transformed.changed) {
          changed = true;
        }
        recordCampusScopeTransformation(stats, copyStatement.table, transformed.reason);
        const hasUnresolvedCampusScopes = hasUnresolvedPartnerCampusSlugs(
          copyStatement.table,
          outputColumns,
          transformed.values,
        );
        if (hasUnresolvedCampusScopes) {
          if (isPartnerCopyBlock) {
            stats.unresolvedPartnerCampusSlugRows += 1;
          }
          if (isPartnerChangeRequestCopyBlock) {
            stats.unresolvedPartnerChangeRequestCampusSlugRows += 1;
          }
        }
        output.push(transformed.values.join("\t"));
      }
      index += 1;
    }
  }

  return {
    sql: output.join("\n"),
    changed,
    stats: copyStats(stats),
  };
}
