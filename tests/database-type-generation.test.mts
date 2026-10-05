import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installGeneratedDatabaseTypes, validateGeneratedDatabaseTypes } from "../scripts/generate-database-types.mjs";

const declaration = (names: string[]) => `export type Json = string | null;
export type Database = { public: { Tables: {
${names.map((name) => `${name}: { Row: { id: string }; Insert: { id?: string }; Update: { id?: string }; Relationships: [] }`).join(";\n")}
}; Views: { [_ in never]: never }; Functions: { [_ in never]: never }; Enums: { [_ in never]: never }; CompositeTypes: { [_ in never]: never } } };`;

test("restricted-role output with empty table types is rejected", () => {
  const output = declaration([]);
  assert.throws(() => validateGeneratedDatabaseTypes(output, ["categories"]), /DATABASE_TYPES_INCOMPLETE/);
});

test("a syntactically valid bootstrap slice cannot replace the full current schema", () => {
  assert.throws(() => validateGeneratedDatabaseTypes(declaration(["categories"]), ["categories", "partners"]), /DATABASE_TYPES_INCOMPLETE/);
});

test("all current tables plus an added migration table are accepted", () => {
  assert.deepEqual(new Set(validateGeneratedDatabaseTypes(declaration(["categories", "partners", "new_table"]), ["categories", "partners"])), new Set(["categories", "partners", "new_table"]));
});

test("the actual empty mapped-table shape cannot replace the current schema", () => {
  const output = declaration([]).replace("Tables: {\n\n}", "Tables: { [_ in never]: never }");
  assert.throws(() => validateGeneratedDatabaseTypes(output, ["categories"]), /DATABASE_TYPES_(?:INCOMPLETE|INVALID)/);
});

test("malformed TypeScript is rejected before it can replace the generated file", () => {
  assert.throws(() => validateGeneratedDatabaseTypes("export type Database = {", ["categories"]), /DATABASE_TYPES_INVALID/);
});

test("a table without a concrete Row contract is rejected", () => {
  const output = declaration(["categories"]).replace("Row: { id: string }", "Row: never");
  assert.throws(() => validateGeneratedDatabaseTypes(output, ["categories"]), /DATABASE_TYPES_INVALID/);
});

test("existing column loss is rejected even when every table name is present", () => {
  assert.throws(() => validateGeneratedDatabaseTypes(declaration(["categories"]), ["categories"], new Map([["categories", ["id", "name"]]])), /DATABASE_TYPES_INCOMPLETE/);
});

for (const scenario of ["command-failure", "incomplete", "temporary-collision", "complete"] as const) {
  test(`generation ${scenario} preserves unrelated files and replaces only a complete result`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "database-types-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const target = join(directory, "database.generated.ts");
    const before = declaration(["categories", "partners"]);
    const complete = declaration(["categories", "partners", "new_table"]);
    await writeFile(target, before);
    if (scenario === "temporary-collision") await writeFile(`${target}.tmp`, "unrelated temporary file");
    const result = { status: scenario === "command-failure" ? 1 : 0, stdout: scenario === "incomplete" ? declaration(["categories"]) : complete };
    if (scenario === "complete") {
      installGeneratedDatabaseTypes(target, result);
      assert.equal(await readFile(target, "utf8"), complete);
    } else {
      assert.throws(() => installGeneratedDatabaseTypes(target, result));
      assert.equal(await readFile(target, "utf8"), before);
    }
    if (scenario === "temporary-collision") assert.equal(await readFile(`${target}.tmp`, "utf8"), "unrelated temporary file");
    else await assert.rejects(readFile(`${target}.tmp`), { code: "ENOENT" });
  });
}
