import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function tableContracts(source) {
  const parsed = ts.createSourceFile("database.generated.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const invalid = () => { throw new Error("DATABASE_TYPES_INVALID"); };
  if (parsed.parseDiagnostics.length) invalid();
  const field = (type, name) => {
    if (!type || !ts.isTypeLiteralNode(type)) invalid();
    return type.members.find((member) => ts.isPropertySignature(member) && member.name?.getText(parsed).replaceAll('"', "") === name)?.type;
  };
  const database = parsed.statements.find((node) => ts.isTypeAliasDeclaration(node) && node.name.text === "Database");
  const tables = field(field(database?.type, "public"), "Tables");
  if (!tables || !ts.isTypeLiteralNode(tables)) invalid();
  const contracts = new Map();
  for (const table of tables.members) {
    if (ts.isIndexSignatureDeclaration(table)) continue;
    if (!ts.isPropertySignature(table) || !table.name) invalid();
    const name = table.name.getText(parsed).replaceAll('"', "");
    const row = field(table.type, "Row");
    if (!row || !ts.isTypeLiteralNode(row) || !row.members.length || contracts.has(name)) invalid();
    contracts.set(name, row.members.map((column) => column.name?.getText(parsed).replaceAll('"', "")));
  }
  return contracts;
}

export function validateGeneratedDatabaseTypes(source, expectedTables = [], expectedColumns = new Map()) {
  const contracts = tableContracts(source);
  if (!contracts.size || expectedTables.some((name) => !contracts.has(name))
    || [...expectedColumns].some(([name, columns]) => columns.some((column) => !contracts.get(name)?.includes(column)))) {
    throw new Error("DATABASE_TYPES_INCOMPLETE");
  }
  return [...contracts.keys()].sort();
}

export function installGeneratedDatabaseTypes(target, result) {
  const expected = tableContracts(readFileSync(target, "utf8"));
  if (result.error || result.status !== 0) throw new Error("DATABASE_TYPE_GENERATION_FAILED");
  validateGeneratedDatabaseTypes(result.stdout, [...expected.keys()], expected);
  const temporary = `${target}.tmp`;
  let created = false;
  try {
    writeFileSync(temporary, result.stdout, { flag: "wx" });
    created = true;
    renameSync(temporary, target);
  } finally {
    if (created) {
      try { unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  }
}

function generate() {
  // Run against an operator-started local database. Never link, migrate or contact Production.
  const result = spawnSync("supabase", ["gen", "types", "typescript", "--local", "--schema", "public"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  installGeneratedDatabaseTypes(resolve("src/lib/supabase/database.generated.ts"), result);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { generate(); } catch {
    process.stderr.write("로컬 DB와 전체 스키마 접근 권한을 확인하세요. 기존 타입 파일은 보존됩니다.\n");
    process.exitCode = 1;
  }
}
