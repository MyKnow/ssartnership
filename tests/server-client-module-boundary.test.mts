import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
