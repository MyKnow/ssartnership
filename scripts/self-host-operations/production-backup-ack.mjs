import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { open, lstat, realpath, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { backupAcknowledgementPath, validateBackupReceipt } from './production-backup-contract.mjs';

const fail = () => { throw new Error('PRODUCTION_BACKUP_ACK_INVALID'); };
const validTime = value => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function validateAcknowledgement(value, now) {
  if (!value || Object.keys(value).sort().join() !== 'backupCreatedAt,copiedAt,id,sha256,version'
    || value.version !== 1 || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value.id ?? '')
    || !/^[a-f0-9]{64}$/u.test(value.sha256 ?? '') || !validTime(value.copiedAt) || !validTime(value.backupCreatedAt)
    || Date.parse(value.copiedAt) < Date.parse(value.backupCreatedAt) || Date.parse(value.copiedAt) > now + 60_000) fail();
  return value;
}

function privateFile(info, uid, maximumBytes = Infinity) {
  if (!info.isFile() || info.uid !== uid || info.mode & 0o077 || info.nlink !== 1 || info.size > maximumBytes) fail();
}

export async function acquireBackupAcknowledgementLock(file) {
  // flock(2) belongs to the shared open-file description. The parent retains
  // that descriptor after this child exits, until the whole transaction closes it.
  await new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/flock', ['--exclusive', '--wait', '10', '3'], { stdio: ['ignore', 'ignore', 'ignore', file.fd] });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error('PRODUCTION_BACKUP_ACK_LOCK_FAILED')));
  });
}

export async function recordBackupAcknowledgement(receipt, command, {
  directory = path.dirname(backupAcknowledgementPath(command)),
  now = Date.now,
  acquireLock = acquireBackupAcknowledgementLock,
} = {}) {
  const value = validateBackupReceipt(receipt);
  const filename = path.basename(backupAcknowledgementPath(command));
  const uid = process.getuid?.() ?? 0;
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== uid || info.mode & 0o077 || await realpath(directory) !== directory) fail();
  const lock = await open(path.join(directory, 'ack.lock'), constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  try {
    privateFile(await lock.stat(), uid);
    await acquireLock(lock);
    const timestamp = now();
    if (!Number.isSafeInteger(timestamp)) fail();
    const candidate = validateAcknowledgement({ version: 1, id: value.id, sha256: value.sha256, copiedAt: new Date(timestamp).toISOString(), backupCreatedAt: value.createdAt }, timestamp);
    const destination = path.join(directory, filename);
    let previous;
    try {
      const file = await open(destination, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        privateFile(await file.stat(), uid, 4096);
        previous = validateAcknowledgement(JSON.parse(await file.readFile('utf8')), timestamp);
      } finally { await file.close(); }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (previous?.id === value.id && (previous.sha256 !== value.sha256 || previous.backupCreatedAt !== value.createdAt)) fail();
    if (previous && (previous.backupCreatedAt.localeCompare(value.createdAt) || previous.id.localeCompare(value.id)) > 0) return previous;
    // Rechecking the same recovery point must still refresh the pull heartbeat.
    // A small clock reversal must never decrease the previous verification time.
    if (previous && previous.copiedAt > candidate.copiedAt) candidate.copiedAt = previous.copiedAt;
    const temporary = path.join(directory, `.ack-${randomUUID()}.tmp`);
    let pending;
    try {
      pending = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      await pending.writeFile(JSON.stringify(candidate));
      await pending.sync();
      await pending.close(); pending = undefined;
      await rename(temporary, destination);
      const parent = await open(directory, constants.O_RDONLY);
      try { await parent.sync(); } finally { await parent.close(); }
      return candidate;
    } finally {
      if (pending) await pending.close();
      await rm(temporary, { force: true });
    }
  } finally { await lock.close(); }
}

export async function verifyAndAcknowledgeBackupCopies(receipts, verifyCopy, acknowledge) {
  if (!Array.isArray(receipts) || receipts.length < 1 || receipts.length > 32) fail();
  const records = receipts.map(validateBackupReceipt).toSorted((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  if (new Set(records.map(value => value.id)).size !== records.length) fail();
  for (const receipt of records) await verifyCopy(receipt);
  const latest = records.at(-1);
  await acknowledge(latest);
  return records;
}

export function backupFailureDiagnostic(error, stage, now = Date.now()) {
  const code = ['EACCES', 'EPERM', 'ENOENT', 'ENOSPC', 'ELOOP', 'EIO', 'ETIMEDOUT'].includes(error?.code) ? error.code : 'VALIDATION_OR_TRANSPORT';
  return { checkedAt: new Date(now).toISOString(), stage, reason: code };
}
