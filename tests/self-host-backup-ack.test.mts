import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { chmod, lstat, mkdtemp, open, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireBackupAcknowledgementLock, recordBackupAcknowledgement, verifyAndAcknowledgeBackupCopies, backupFailureDiagnostic } from '../scripts/self-host-operations/production-backup-ack.mjs';

const now = Date.parse('2026-10-18T02:00:00.000Z');
const receipt = (n: number) => ({ version: 1, id: `12345678-1234-4234-8234-${String(n).padStart(12, '0')}`, createdAt: new Date(now - (10 - n) * 3_600_000).toISOString(), bytes: 2048, sha256: 'a'.repeat(64), recipient: `age1${'q'.repeat(58)}`, databaseSystemId: '7683514695522750473', continuousPitr: false });
type Receipt = ReturnType<typeof receipt>;

// macOS has the same flock(2) lifetime semantics but no util-linux CLI. This
// adapter exercises the real advisory lock through the inherited descriptor.
async function acquireLock(file: { fd: number }) {
  if (existsSync('/usr/bin/flock')) return acquireBackupAcknowledgementLock(file);
  await new Promise<void>((resolve, reject) => {
    const script = 'import fcntl,time\ndeadline=time.monotonic()+10\nwhile True:\n try: fcntl.flock(3,fcntl.LOCK_EX|fcntl.LOCK_NB);break\n except BlockingIOError:\n  if time.monotonic()>=deadline: raise TimeoutError()\n  time.sleep(0.01)';
    const child = spawn(process.platform === 'win32' ? 'python' : 'python3', ['-c', script], { stdio: ['ignore', 'ignore', 'ignore', file.fd] });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error('TEST_LOCK_FAILED')));
  });
}

async function fixture(run: (directory: string) => Promise<void>) {
  const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'backup-ack-')));
  await chmod(directory, 0o700);
  try { await run(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}

const options = (directory: string, timestamp = now) => ({ directory, now: () => timestamp, acquireLock });
const state = async (directory: string, channel = 'latest.json') => JSON.parse(await readFile(path.join(directory, channel), 'utf8'));

test('an older ACK cannot replace the latest verified Mac recovery point', async () => {
  await fixture(async directory => {
    const latest = await recordBackupAcknowledgement(receipt(8), 'ack', options(directory));
    await recordBackupAcknowledgement(receipt(1), 'ack', options(directory, now + 900_000));
    assert.deepEqual(await state(directory), latest);
    assert.equal((await lstat(path.join(directory, 'latest.json'))).mode & 0o777, 0o600);
  });
});

test('the same PVE copy refreshes its 15 minute heartbeat without changing its recovery point', async () => {
  await fixture(async directory => {
    await recordBackupAcknowledgement(receipt(8), 'ack-pve', options(directory));
    const next = await recordBackupAcknowledgement(receipt(8), 'ack-pve', options(directory, now + 900_000));
    assert.equal(next.copiedAt, new Date(now + 900_000).toISOString());
    assert.equal(next.backupCreatedAt, receipt(8).createdAt);
    assert.equal((await readdir(directory)).includes('latest.json'), false);
    await recordBackupAcknowledgement(receipt(8), 'ack-pve', options(directory, now + 899_000));
    assert.deepEqual(await state(directory, 'latest-pve.json'), next);
  });
});

test('equal-time backup IDs use the same ordering on the client and server', async () => {
  await fixture(async directory => {
    const latest = receipt(9), earlier = { ...receipt(1), createdAt: latest.createdAt };
    const previous = await recordBackupAcknowledgement(latest, 'ack', options(directory));
    await recordBackupAcknowledgement(earlier, 'ack', options(directory, now + 900_000));
    assert.deepEqual(await state(directory), previous);
    await verifyAndAcknowledgeBackupCopies([latest, earlier], async () => {}, async (value: Receipt) => {
      assert.equal(value.id, latest.id);
    });
  });
});

test('simultaneous ACKs serialize actual filesystem writes and keep Mac and PVE state independent', async () => {
  await fixture(async directory => {
    await Promise.all(Array.from({ length: 20 }, (_, n) => recordBackupAcknowledgement(receipt(n % 10), n % 2 ? 'ack' : 'ack-pve', options(directory))));
    assert.equal((await state(directory)).backupCreatedAt, receipt(9).createdAt);
    assert.equal((await state(directory, 'latest-pve.json')).backupCreatedAt, receipt(8).createdAt);
    assert.deepEqual((await readdir(directory)).sort(), ['ack.lock', 'latest-pve.json', 'latest.json']);
  });
});

test('invalid or future existing ACKs fail closed and leave the exact state intact', async () => {
  await fixture(async directory => {
    const good = { version: 1, id: receipt(8).id, sha256: receipt(8).sha256, copiedAt: new Date(now).toISOString(), backupCreatedAt: receipt(8).createdAt };
    for (const value of ['{', JSON.stringify({ ...good, copiedAt: new Date(now + 60_001).toISOString() }), JSON.stringify({ ...good, copiedAt: 'invalid' }), JSON.stringify({ ...good, sha256: 'wrong' }), JSON.stringify({ ...good, version: 2 }), JSON.stringify({ ...good, extra: true })]) {
      await writeFile(path.join(directory, 'latest.json'), value, { mode: 0o600 });
      await assert.rejects(recordBackupAcknowledgement(receipt(9), 'ack', options(directory)));
      assert.equal(await readFile(path.join(directory, 'latest.json'), 'utf8'), value);
    }
  });
});

test('receipt and hash conflicts cannot alter a successful ACK', async () => {
  await fixture(async directory => {
    const original = await recordBackupAcknowledgement(receipt(8), 'ack', options(directory));
    for (const value of [{ ...receipt(8), sha256: 'b'.repeat(64) }, { ...receipt(8), createdAt: receipt(9).createdAt }, { ...receipt(8), id: '../other' }, { ...receipt(8), sha256: 'bad' }, { ...receipt(8), bytes: 0 }, { ...receipt(8), createdAt: new Date(now + 1).toISOString() }]) {
      await assert.rejects(recordBackupAcknowledgement(value, 'ack', options(directory)));
      assert.deepEqual(await state(directory), original);
    }
    await assert.rejects(recordBackupAcknowledgement(receipt(9), 'get', options(directory)));
  });
});

test('symlink ACKs and locks, public state, and symlink directories fail without modifying targets', { skip: process.platform === 'win32' }, async () => {
  await fixture(async directory => {
    const outside = path.join(directory, 'outside');
    await writeFile(outside, 'protected', { mode: 0o600 });
    for (const filename of ['latest.json', 'ack.lock']) {
      const target = path.join(directory, filename);
      await rm(target, { force: true });
      await symlink(outside, target);
      await assert.rejects(recordBackupAcknowledgement(receipt(8), 'ack', options(directory)));
      assert.equal(await readFile(outside, 'utf8'), 'protected');
      await rm(target);
    }
    const link = path.join(directory, 'linked');
    await symlink(directory, link);
    await assert.rejects(recordBackupAcknowledgement(receipt(8), 'ack', options(link)));
    await rm(link);
    await recordBackupAcknowledgement(receipt(8), 'ack', options(directory));
    await chmod(path.join(directory, 'latest.json'), 0o640);
    await assert.rejects(recordBackupAcknowledgement(receipt(9), 'ack', options(directory)));
  });
});

test('a failed transaction closes its lock descriptor before the next ACK', async () => {
  await fixture(async directory => {
    await assert.rejects(recordBackupAcknowledgement(receipt(8), 'ack', { ...options(directory), now: () => { throw new Error('interrupted'); } }));
    await recordBackupAcknowledgement(receipt(9), 'ack', options(directory));
    assert.equal((await state(directory)).id, receipt(9).id);
  });
});

test('the lock remains held after its acquisition subprocess exits until the parent descriptor closes', async () => {
  await fixture(async directory => {
    const lock = await open(path.join(directory, 'ack.lock'), 'a', 0o600);
    await acquireLock(lock);
    let entered = false;
    const waiting = recordBackupAcknowledgement(receipt(9), 'ack', { ...options(directory), now: () => { entered = true; return now; } });
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(entered, false);
    } finally { await lock.close(); }
    await waiting;
    assert.equal(entered, true);
  });
});

test('process death releases a held acknowledgement lock with no stale PID recovery', { skip: process.platform === 'win32' }, async () => {
  await fixture(async directory => {
    const helper = fileURLToPath(new URL('../scripts/self-host-operations/production-backup-ack.mjs', import.meta.url));
    const script = `import {open} from 'node:fs/promises'; import {existsSync} from 'node:fs'; import {spawn} from 'node:child_process'; import {acquireBackupAcknowledgementLock} from ${JSON.stringify(new URL(`file://${helper}`).href)};
      const lock=await open(${JSON.stringify(path.join(directory, 'ack.lock'))},'a',0o600);
      if(existsSync('/usr/bin/flock')) await acquireBackupAcknowledgementLock(lock); else await new Promise((resolve,reject)=>{const child=spawn('python3',['-c','import fcntl;fcntl.flock(3,fcntl.LOCK_EX)'],{stdio:['ignore','ignore','ignore',lock.fd]});child.once('error',reject);child.once('close',code=>code===0?resolve():reject(Error()));});
      process.send('locked');setInterval(()=>{},1000);`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    try {
      await new Promise<void>((resolve, reject) => { child.once('message', () => resolve()); child.once('error', reject); child.once('exit', () => reject(new Error('lock owner exited before acquisition'))); });
      child.kill('SIGKILL');
      await new Promise(resolve => child.once('close', resolve));
      await recordBackupAcknowledgement(receipt(9), 'ack', options(directory));
      assert.equal((await state(directory)).id, receipt(9).id);
    } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
  });
});

test('Mac acknowledges only the newest copy after the entire unordered receipt list is verified', async () => {
  const verified: string[] = [], acknowledged: string[] = [];
  const records = await verifyAndAcknowledgeBackupCopies([receipt(9), receipt(1), receipt(5)], async (value: Receipt) => { verified.push(value.id); }, async (value: Receipt) => {
    assert.equal(verified.length, 3);
    acknowledged.push(value.id);
  });
  assert.deepEqual(verified, [receipt(1).id, receipt(5).id, receipt(9).id]);
  assert.deepEqual(acknowledged, [receipt(9).id]);
  assert.deepEqual(records.map((value: Receipt) => value.id), verified);
});

test('an interrupted Mac recheck of an older copy never publishes an intermediate ACK', async () => {
  await fixture(async directory => {
    const previous = await recordBackupAcknowledgement(receipt(9), 'ack', options(directory));
    await assert.rejects(verifyAndAcknowledgeBackupCopies([receipt(1), receipt(5), receipt(9)], async (value: Receipt) => {
      if (value.id === receipt(5).id) throw new Error('simulated verification interruption');
    }, async (value: Receipt) => { await recordBackupAcknowledgement(value, 'ack', options(directory)); }));
    assert.deepEqual(await state(directory), previous);
    for (const values of [[], [receipt(1), receipt(1)], [{ ...receipt(1), bytes: 0 }]]) {
      await assert.rejects(verifyAndAcknowledgeBackupCopies(values, async () => assert.fail('invalid list was processed'), async () => assert.fail('invalid list was acknowledged')));
    }
  });
});

test('backup diagnostics contain a fixed stage and safe classification without raw error details', () => {
  const error = Object.assign(new Error('password=secret command=private'), { code: 'EACCES', stdout: 'private', stderr: 'private' });
  assert.deepEqual(backupFailureDiagnostic(error, 'receipt-verification', now), { checkedAt: new Date(now).toISOString(), stage: 'receipt-verification', reason: 'EACCES' });
  assert.equal(JSON.stringify(backupFailureDiagnostic({ code: 'secret' }, 'download', now)).includes('secret'), false);
});
