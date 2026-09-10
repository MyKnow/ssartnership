import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, unlink, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { onlineBaseBackupArguments, storageVersionPath, copyVersionFiles, verifyReferencedStorage } from '../scripts/self-host-operations/production-online-backup.mjs';
import { assertRestoreSnapshotKind } from '../scripts/self-host-operations/restore-production-backup.mjs';
import { addLocalBackupReplicationRule } from '../scripts/self-host-operations/prepare-online-backup.mjs';

const object = { bucket_id: 'images', name: 'nested/photo.png', version: '12345678-1234-4234-8234-123456789abc', metadata: { size: 3 } };
test('backup preparation preserves existing authentication and adds only one local replication rule', () => {
  const initial = 'local all all trust\nhost all all 127.0.0.1/32 scram-sha-256\n';
  const updated = addLocalBackupReplicationRule(initial);
  assert.ok(updated.startsWith(initial));
  assert.equal(addLocalBackupReplicationRule(updated), updated);
  assert.equal(updated.split('\n').filter(line => line === 'local replication supabase_admin trust').length, 1);
  assert.equal(updated.split('\n').filter(line => line.startsWith('host ')).length, 1);
});
test('online base backup requires WAL and never stops the source or writes recovery connection secrets', () => {
  const args = onlineBaseBackupArguments('ssartnership-test-db');
  assert.ok(args.includes('--wal-method=fetch'));
  assert.ok(args.includes('--pgdata=-'));
  assert.ok(args.includes('--no-password'));
  assert.ok(!args.includes('stop') && !args.includes('--write-recovery-conf'));
  assert.throws(() => onlineBaseBackupArguments('--privileged'));
});
test('storage version paths reject traversal, non-versioned objects and malformed size', () => {
  assert.equal(storageVersionPath(object), `stub/stub/images/nested/photo.png/${object.version}`);
  for (const bad of [{ ...object, name: '../data' }, { ...object, name: '/absolute' }, { ...object, name: 'a\\b' }, { ...object, bucket_id: '..' }, { ...object, version: '' }, { ...object, metadata: { size: -1 } }]) assert.throws(() => storageVersionPath(bad));
});
test('restore distinguishes an online normalized clone from an unverified or incomplete source copy', () => {
  const online = { version: 1, kind: 'production-online-snapshot', applicationWritesQuiesced: false, databaseCleanlyStopped: true, sourceRemainedRunning: true, onlineBaseBackupVerified: true, storageReferencesVerified: 1 };
  assert.doesNotThrow(() => assertRestoreSnapshotKind(online));
  for (const invalid of [{ ...online, onlineBaseBackupVerified: false }, { ...online, sourceRemainedRunning: false }, { ...online, databaseCleanlyStopped: false }, { ...online, storageReferencesVerified: -1 }]) assert.throws(() => assertRestoreSnapshotKind(invalid));
  assert.doesNotThrow(() => assertRestoreSnapshotKind({ version: 1, kind: 'production-cold-snapshot', applicationWritesQuiesced: true, databaseCleanlyStopped: true }));
});
test('paired storage retains a deleted old version and captures new versions without modifying live data', { skip: process.platform !== 'linux' }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'online-pair-'));
  const source = path.join(root, 'source'), destination = path.join(root, 'copy');
  const relative = storageVersionPath(object);
  try {
    await mkdir(path.dirname(path.join(source, relative)), { recursive: true }); await mkdir(destination);
    await writeFile(path.join(source, relative), 'old');
    await copyVersionFiles(source, destination);
    await unlink(path.join(source, relative));
    const newer = { ...object, version: '22345678-1234-4234-8234-123456789abc' };
    await writeFile(path.join(source, storageVersionPath(newer)), 'new');
    await copyVersionFiles(source, destination);
    assert.equal(await verifyReferencedStorage(destination, [object, newer]), 2);
    assert.equal(await readFile(path.join(destination, relative), 'utf8'), 'old');
    await assert.rejects(verifyReferencedStorage(destination, [{ ...object, metadata: { size: 99 } }]));
    await assert.rejects(verifyReferencedStorage(destination, [{ ...object, version: '32345678-1234-4234-8234-123456789abc' }]));
    await writeFile(path.join(source, storageVersionPath(newer)), 'bad');
    await assert.rejects(copyVersionFiles(source, destination));
    assert.equal(await readFile(path.join(destination, storageVersionPath(newer)), 'utf8'), 'new');
    await symlink('/etc/passwd', path.join(source, 'escape'));
    await assert.rejects(copyVersionFiles(source, destination));
  } finally { await rm(root, { recursive: true, force: true }); }
});
