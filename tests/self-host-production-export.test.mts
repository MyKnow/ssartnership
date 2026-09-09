import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cloudConnection } from '../scripts/self-host-migration/database.mjs';
import { storageDownloadUrl } from '../scripts/self-host-migration/storage.mjs';
import { validateTransferReceipt } from '../scripts/self-host-migration/transfer.mjs';
const production = 'jlcrhzmiuygqnkwmzfyr';
const preview = 'uuxzzanpxzvhauzxufuk';
test('Production export pins the source database and never accepts Preview credentials', () => {
  const connection = cloudConnection(`postgresql://postgres:fixture@db.${production}.supabase.co/postgres`, production);
  assert.equal(connection.PGHOST, `db.${production}.supabase.co`);
  assert.equal(connection.PGSSLMODE, 'verify-full');
  assert.match(connection.PGOPTIONS, /default_transaction_read_only=on/);
  assert.throws(() => cloudConnection(`postgresql://postgres:fixture@db.${preview}.supabase.co/postgres`, production));
  assert.throws(() => cloudConnection('postgresql://postgres:fixture@db.attacker.supabase.co/postgres', 'attacker'));
});
test('Production Storage credentials have one fixed origin and encoded object paths', () => {
  const object = { bucket_id: 'private', name: 'folder/a b.png' };
  assert.equal(storageDownloadUrl(object, production), `https://${production}.supabase.co/storage/v1/object/authenticated/private/folder/a%20b.png`);
  assert.match(storageDownloadUrl(object), new RegExp(preview));
  assert.throws(() => storageDownloadUrl(object, 'attacker'));
});
test('Transfer receipts bind Production ciphertext to the exact project, SHA and run', () => {
  const context = { sourceProject: production, sha: 'a'.repeat(40), runId: 123 };
  const receipt = { version: 1, ...context, recipient: 'age1'+'q'.repeat(58), bytes: 300, plaintextBytes: 100, sha256: 'b'.repeat(64), file: 'snapshot.tar.age' };
  assert.equal(validateTransferReceipt(receipt, context), receipt);
  assert.throws(() => validateTransferReceipt({ ...receipt, sourceProject: preview }, context));
  assert.throws(() => validateTransferReceipt(receipt, { ...context, runId: 124 }));
});

import { exportContext, validateExportRequest, validateProductionApi } from '../scripts/self-host-migration/github-production-export.mjs';
import { readFileSync } from 'node:fs';
const env = {
  GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', GITHUB_REPOSITORY: 'MyKnow/ssartnership',
  GITHUB_REF: 'refs/heads/feat/self-host-production-20260909',
  GITHUB_WORKFLOW_REF: 'MyKnow/ssartnership/.github/workflows/self-host-production-export.yml@refs/heads/feat/self-host-production-20260909',
  GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '123',
};
test('Production export accepts only the dedicated first-attempt workflow and fresh request', () => {
  assert.equal(exportContext(env).sourceProject, production);
  for (const patch of [{ GITHUB_RUN_ATTEMPT: '2' }, { GITHUB_EVENT_NAME: 'pull_request' }, { GITHUB_REF: 'refs/heads/dev' }, { GITHUB_REPOSITORY: 'other/repo' }]) assert.throws(() => exportContext({ ...env, ...patch }));
  const now = Date.parse('2026-09-09T12:00:00Z');
  const request = { version: 1, sourceProject: production, expiresAt: '2026-09-09T13:00:00Z' };
  assert.equal(validateExportRequest(request, now), request);
  for (const patch of [{ sourceProject: preview }, { expiresAt: '2026-09-10T13:00:00Z' }, { expiresAt: '2026-09-09T11:00:00Z' }]) assert.throws(() => validateExportRequest({ ...request, ...patch }, now));
});
test('Production API token identity and encryption workflow exclude other sources and plaintext artifacts', () => {
  const token = (ref: string) => `e30.${Buffer.from(JSON.stringify({ ref, role: 'service_role' })).toString('base64url')}.fixture`;
  assert.doesNotThrow(() => validateProductionApi(`https://${production}.supabase.co`, token(production)));
  assert.throws(() => validateProductionApi(`https://${preview}.supabase.co`, token(production)));
  assert.throws(() => validateProductionApi(`https://${production}.supabase.co`, token(preview)));
  const workflow = readFileSync(new URL('../.github/workflows/self-host-production-export.yml', import.meta.url), 'utf8');
  assert.match(workflow, /SUPABASE_PRODUCTION_DB_URL/);
  assert.doesNotMatch(workflow, /SUPABASE_PREVIEW_|npm (?:ci|install)|cancel-in-progress: true/);
  const artifact = workflow.slice(workflow.indexOf('- name: Upload ciphertext only'));
  assert.match(artifact, /encrypted\/snapshot\.tar\.age/);
  assert.doesNotMatch(artifact, /database\.dump|payload\/|snapshot\.tar\s/);
});
