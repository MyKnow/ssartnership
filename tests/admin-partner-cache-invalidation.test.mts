import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(repoRoot, "src");
const helpersPath = path.join(
  srcRoot,
  "app/admin/(protected)/_actions/shared-helpers.ts",
);
const helpersSource = readFileSync(helpersPath, "utf8");

// Helpers that expire public catalog tags with updateTag (Server Action only).
const UPDATE_TAG_HELPERS = [
  "revalidateAdminAndPublicPaths",
  "revalidateCategoryData",
  "revalidatePartnerCompanyData",
] as const;

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return listSourceFiles(fullPath);
    }
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function functionBody(source: string, name: string) {
  const start = source.indexOf(`export function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = source.indexOf("\n}\n", start);
  return source.slice(start, end);
}

test("admin partner/category helpers expire public tags with updateTag once", () => {
  const partnersTag = /updateTag\((?:"partners"|PARTNERS_CACHE_TAG)\)/;
  const categoriesTag = /updateTag\((?:"categories"|CATEGORIES_CACHE_TAG)\)/;

  assert.match(functionBody(helpersSource, "revalidateAdminAndPublicPaths"), partnersTag);
  assert.match(functionBody(helpersSource, "revalidatePartnerCompanyData"), partnersTag);
  assert.match(functionBody(helpersSource, "revalidateCategoryData"), categoriesTag);
  assert.doesNotMatch(
    helpersSource,
    /revalidateTag\((?:"partners"|"categories"|PARTNERS_CACHE_TAG|CATEGORIES_CACHE_TAG)/,
  );
  // revalidatePartnerData only repeated the partners tag that
  // revalidateAdminAndPublicPaths already expires.
  assert.doesNotMatch(helpersSource, /export function revalidatePartnerData\(/);
});

test("no caller keeps the removed duplicate partner tag helper", () => {
  const offenders = listSourceFiles(srcRoot)
    .filter((file) => readFileSync(file, "utf8").includes("revalidatePartnerData"))
    .map((file) => path.relative(repoRoot, file));
  assert.deepEqual(offenders, []);
});

test("updateTag helpers are only reachable from Server Action modules", () => {
  const barrel = readFileSync(
    path.join(srcRoot, "app/admin/(protected)/actions.ts"),
    "utf8",
  );
  assert.match(barrel, /^"use server";/);

  const importers = listSourceFiles(srcRoot).filter((file) => {
    if (file === helpersPath) {
      return false;
    }
    const source = readFileSync(file, "utf8");
    return (
      source.includes("_actions/shared-helpers")
      && UPDATE_TAG_HELPERS.some((name) => new RegExp(`\\b${name}\\b`).test(source))
    );
  });
  assert.ok(importers.length > 0, "expected admin actions to use the partner helpers");

  for (const file of importers) {
    const relative = path.relative(repoRoot, file);
    const source = readFileSync(file, "utf8");
    assert.ok(!/route\.tsx?$/.test(file), `${relative}: route handlers must use revalidateTag`);
    assert.ok(!relative.startsWith("src/lib/"), `${relative}: lib modules may run outside actions`);
    assert.ok(
      source.startsWith('"use server";') || relative.includes("/_actions/"),
      `${relative}: must be a "use server" module or an _actions module behind the barrel`,
    );
  }
});
