import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PROJECT_SHOWCASE_SLUG } from "../src/lib/project-showcase/types.ts";

// revalidatePath(pattern, "page" | "layout") is matched against the implicit
// tags Next derives from the page file path, route groups included
// (`/(site)/events/[slug]/page`). A pattern that drops the group or points at a
// missing route matches nothing and silently stops invalidating.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(repoRoot, "src");
const appRoot = path.join(srcRoot, "app");

const importedConstants: Record<string, string> = { PROJECT_SHOWCASE_SLUG };

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return listSourceFiles(fullPath);
    }
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function readLocalConstants(source: string) {
  const constants: Record<string, string> = {};
  for (const match of source.matchAll(/^const ([A-Z_][A-Z0-9_]*) = (["`])([^"`]*)\2;/gm)) {
    constants[match[1]] = match[3];
  }
  return constants;
}

function resolveTemplate(value: string, constants: Record<string, string>, depth = 0): string {
  assert.ok(depth < 5, `typed revalidate path constant is too deeply nested: ${value}`);
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => {
    const resolved = constants[name];
    assert.ok(
      resolved !== undefined,
      `typed revalidate path uses ${name}, which this contract cannot resolve`,
    );
    return resolveTemplate(resolved, constants, depth + 1);
  });
}

function assertRouteExists(routePath: string, type: "page" | "layout", origin: string) {
  const routeDir = path.join(appRoot, ...routePath.split("/").filter(Boolean));
  if (type === "page") {
    assert.ok(
      existsSync(path.join(routeDir, "page.tsx")),
      `${origin}: revalidatePath("${routePath}", "page") has no src/app${routePath}/page.tsx (route group missing?)`,
    );
    return;
  }
  assert.ok(
    existsSync(routeDir) && statSync(routeDir).isDirectory(),
    `${origin}: revalidatePath("${routePath}", "layout") has no src/app${routePath} directory (route group missing?)`,
  );
}

test("typed revalidatePath patterns point at real route files including route groups", () => {
  const typedCall = /revalidatePath\(\s*(["`])([^"`]+)\1\s*,\s*"(page|layout)"\s*\)/g;
  let checked = 0;
  for (const file of listSourceFiles(srcRoot)) {
    const source = readFileSync(file, "utf8");
    if (!source.includes("revalidatePath(")) {
      continue;
    }
    const constants = { ...importedConstants, ...readLocalConstants(source) };
    for (const match of source.matchAll(typedCall)) {
      const routePath = resolveTemplate(match[2], constants);
      assertRouteExists(
        routePath,
        match[3] as "page" | "layout",
        path.relative(repoRoot, file),
      );
      checked += 1;
    }
  }
  assert.ok(checked > 0, "expected at least one typed revalidatePath call");
});

test("promotion event page patterns keep their route groups", async () => {
  const { PROMOTION_EVENT_PAGE_PATTERNS } = await import(
    new URL("../src/lib/promotions/cache-invalidation.ts", import.meta.url).href
  ) as typeof import("../src/lib/promotions/cache-invalidation.ts");

  assert.deepEqual([...PROMOTION_EVENT_PAGE_PATTERNS], [
    "/admin/(protected)/event/[slug]",
    "/(site)/events/[slug]",
  ]);
  for (const pattern of PROMOTION_EVENT_PAGE_PATTERNS) {
    assertRouteExists(pattern, "page", "src/lib/promotions/cache-invalidation.ts");
  }
});

test("partner service invalidation keeps the literal detail path without a dead pattern", () => {
  const source = readFileSync(
    path.join(appRoot, "partner/services/[partnerId]/request/_actions/shared.ts"),
    "utf8",
  );
  assert.match(source, /revalidatePath\(`\/partners\/\$\{partnerId\}`\)/);
  assert.doesNotMatch(source, /revalidatePath\("\/partners\/\[id\]", "page"\)/);
});
