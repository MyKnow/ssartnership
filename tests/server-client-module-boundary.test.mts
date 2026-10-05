import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path, { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("공용 정책·인증 카드 모듈은 서버 저장소 의존성을 포함하지 않는다", () => {
  const policyDocuments = readRepoFile("src/lib/policy-documents.ts");
  const cohortCardThemes = readRepoFile("src/lib/cohort-card-themes.ts");
  const certificationScheme = readRepoFile("src/lib/certification-scheme.ts");

  for (const source of [
    policyDocuments,
    cohortCardThemes,
    certificationScheme,
  ]) {
    assert.doesNotMatch(source, /server-only|supabase\/server/);
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|getSupabaseAdminClient/);
  }

  assert.doesNotMatch(
    policyDocuments,
    /export async function (?:getActiveRequiredPolicies|getPolicyDocumentByKind|getMemberPolicyConsentVersions|recordRequiredPolicyConsent)/,
  );
  assert.doesNotMatch(
    cohortCardThemes,
    /export async function (?:listCohortCardThemes|upsertCohortCardTheme|deleteCohortCardTheme)/,
  );
  assert.match(
    certificationScheme,
    /from "@\/lib\/cohort-card-themes"/,
  );
});

test("정책·인증 카드 저장소와 Supabase 팩터리는 서버 전용으로 표시된다", () => {
  const policyDocumentsServer = readRepoFile(
    "src/lib/policy-documents.server.ts",
  );
  const cohortCardThemesServer = readRepoFile(
    "src/lib/cohort-card-themes.server.ts",
  );
  const supabaseServer = readRepoFile("src/lib/supabase/server.ts");

  for (const source of [
    policyDocumentsServer,
    cohortCardThemesServer,
    supabaseServer,
  ]) {
    assert.match(source, /^import "server-only";/);
  }

  assert.match(policyDocumentsServer, /from "@\/lib\/policy-documents"/);
  assert.match(policyDocumentsServer, /from "@\/lib\/supabase\/server"/);
  assert.match(cohortCardThemesServer, /from "@\/lib\/cohort-card-themes"/);
  assert.match(cohortCardThemesServer, /from "@\/lib\/supabase\/server"/);
});

test("클라이언트 컴포넌트는 순수 공용 정책·카드 모듈만 가져온다", () => {
  const clientFiles = [
    "src/components/auth/PolicyAgreementField.tsx",
    "src/components/auth/PolicyConsentForm.tsx",
    "src/components/certification/CertificationView.tsx",
    "src/components/legal/PolicyDocumentVersionSelect.tsx",
    "src/components/push/PushSettingsCard.tsx",
  ];

  for (const file of clientFiles) {
    const source = readRepoFile(file);
    assert.match(source, /^"use client";/);
    assert.doesNotMatch(
      source,
      /@\/lib\/(?:policy-documents|cohort-card-themes)\.server|@\/lib\/supabase\/server/,
      file,
    );
  }
});

/**
 * A "use client" module and everything it imports (transitively) ships to the
 * browser bundle. Modules that read session secrets, sign tokens, or create
 * the service-role Supabase client must never enter that graph. The walk
 * stops at "use server" modules because the client receives only an action
 * reference for them, not their imports.
 */
const srcRoot = path.join(repoRoot, "src");

const SECRET_MODULES = [
  "src/lib/auth.ts",
  "src/lib/user-auth.ts",
  "src/lib/partner-session.ts",
  "src/lib/cron-route.ts",
  "src/lib/admin-security.ts",
  "src/lib/supabase/server.ts",
  "src/lib/push/config.ts",
  "src/lib/session-secrets.ts",
  "src/lib/session-tokens.ts",
];
const SERVER_ONLY_SPECIFIERS = new Set(["server-only", "next/headers"]);
const EXTENSIONS = ["", ".ts", ".tsx", ".mts", ".mjs", ".js"];
const INDEX_EXTENSIONS = [".ts", ".tsx", ".mts", ".mjs", ".js"];

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(absolute);
    return /\.(?:tsx?|mjs|js)$/.test(entry.name) && !/\.stories\.tsx?$/.test(entry.name)
      ? [absolute]
      : [];
  });
}

function readDirective(source: string) {
  const match = source.match(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["'](use client|use server)["']/);
  return match?.[1] ?? null;
}

function isFile(candidate: string) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function resolveLocal(specifier: string, importer: string) {
  let base: string | null = null;
  if (specifier.startsWith("@/")) base = path.join(srcRoot, specifier.slice(2));
  else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    base = path.resolve(path.dirname(importer), specifier);
  }
  if (!base) return null;
  for (const extension of EXTENSIONS) {
    if (isFile(base + extension)) return base + extension;
  }
  for (const extension of INDEX_EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function isTypeOnlyClause(clause: string) {
  const trimmed = clause.trim();
  if (/^type\s/.test(trimmed)) return true;
  const named = trimmed.match(/^\{([\s\S]*)\}$/);
  if (!named) return false;
  const specifiers = named[1].split(",").map((part) => part.trim()).filter(Boolean);
  return specifiers.length > 0 && specifiers.every((part) => /^type\s/.test(part));
}

function readRuntimeImportSpecifiers(source: string) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const specifiers: string[] = [];
  const staticImport = /\b(import|export)\s+([^"';]*?)\s*from\s*["']([^"']+)["']/g;
  for (const match of withoutComments.matchAll(staticImport)) {
    if (!isTypeOnlyClause(match[2])) specifiers.push(match[3]);
  }
  for (const match of withoutComments.matchAll(/\bimport\s*["']([^"']+)["']/g)) {
    specifiers.push(match[1]);
  }
  for (const match of withoutComments.matchAll(/(?<!typeof\s+)\bimport\(\s*["']([^"']+)["']\s*\)/g)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function findForbiddenPath(entry: string) {
  const forbidden = new Set(SECRET_MODULES.map((relative) => path.join(repoRoot, relative)));
  const parents = new Map<string, string | null>([[entry, null]]);
  const queue = [entry];
  const chainTo = (file: string) => {
    const chain: string[] = [];
    for (let current: string | null = file; current; current = parents.get(current) ?? null) {
      chain.unshift(path.relative(repoRoot, current));
    }
    return chain;
  };

  while (queue.length > 0) {
    const file = queue.shift()!;
    const source = readFileSync(file, "utf8");
    if (file !== entry && readDirective(source) === "use server") continue;
    for (const specifier of readRuntimeImportSpecifiers(source)) {
      if (SERVER_ONLY_SPECIFIERS.has(specifier)) {
        return [...chainTo(file), specifier];
      }
      const resolved = resolveLocal(specifier, file);
      if (!resolved || parents.has(resolved)) continue;
      parents.set(resolved, file);
      if (forbidden.has(resolved)) return chainTo(resolved);
      queue.push(resolved);
    }
  }
  return null;
}

test("import 파서는 타입 전용 import를 제외하고 런타임 의존성만 센다", () => {
  assert.deepEqual(
    readRuntimeImportSpecifiers([
      'import type { A } from "@/lib/auth";',
      'import { type B, type C } from "@/lib/user-auth";',
      'import { type D, e } from "@/lib/partner-session";',
      'export { f } from "./f";',
      'import "./side-effect";',
      'const lazy = () => import("@/lib/lazy");',
      'type Client = typeof import("@/lib/supabase/server").getSupabaseAdminClient;',
      '// import { g } from "@/lib/commented";',
    ].join("\n")),
    ["@/lib/partner-session", "./f", "./side-effect", "@/lib/lazy"],
  );
});

test("클라이언트 컴포넌트의 전이 import는 세션 비밀값·서버 전용 모듈에 닿지 않는다", () => {
  for (const relative of SECRET_MODULES) {
    assert.ok(isFile(path.join(repoRoot, relative)), `${relative} must exist`);
  }

  const clientEntries = listSourceFiles(srcRoot).filter(
    (file) => readDirective(readFileSync(file, "utf8")) === "use client",
  );
  assert.ok(clientEntries.length > 100, "client entry discovery must find the app's client components");

  const violations = clientEntries
    .map((entry) => findForbiddenPath(entry))
    .filter((chain): chain is string[] => chain !== null)
    .map((chain) => chain.join(" -> "));

  assert.deepEqual(violations, []);
});
