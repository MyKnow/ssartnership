#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile, rename, lstat, statfs, rm, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import os from 'node:os';
import path from 'node:path';
import { validateBackupReceipt, selectBackupRetention } from './production-backup-contract.mjs';
const ROOT = path.join(os.homedir(), 'Library/Application Support/ssartnership-backups/production');
const SSH = ['-F', '/dev/null', '-S', 'none', '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'GlobalKnownHostsFile=/dev/null', '-o', `UserKnownHostsFile="${ROOT}/known_hosts"`, '-o', 'HostKeyAlias=192.168.1.191', '-o', 'ForwardAgent=no', '-o', 'ClearAllForwardings=yes', '-o', 'ConnectTimeout=8', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3', '-i', `${ROOT}/ssh-key`, 'ssartnership-backup@100.121.111.50'];
const ssh = command => execFileSync('/usr/bin/ssh', [...SSH, command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 128 * 1024, timeout: 20000 });
async function hashFile(file) { const hash = createHash('sha256'); for await (const bytes of createReadStream(file)) hash.update(bytes); return hash.digest('hex'); }
let locked = false;
try {
  if (process.platform !== 'darwin' || await realpath(ROOT) !== ROOT) throw Error();
  const root = await lstat(ROOT); if (root.uid !== process.getuid() || root.mode & 0o077) throw Error();
  try { await mkdir(`${ROOT}/pull.lock`, { mode: 0o700 }); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const info = await lstat(`${ROOT}/pull.lock`); if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid()) throw Error();
    let previous;
    try { previous = JSON.parse(await readFile(`${ROOT}/pull.lock/owner.json`, 'utf8')); }
    catch (cause) { if (cause.code !== 'ENOENT' || Date.now() - info.mtimeMs < 20 * 60000) throw cause; }
    if (previous) {
      if (!Number.isSafeInteger(previous.pid) || previous.pid <= 1) throw Error();
      try { process.kill(previous.pid, 0); throw Error(); } catch (cause) { if (cause.code !== 'ESRCH') throw cause; }
    }
    await rename(`${ROOT}/pull.lock`, `${ROOT}/interrupted-lock-${Date.now()}`);
    await mkdir(`${ROOT}/pull.lock`, { mode: 0o700 });
  }
  locked = true; await writeFile(`${ROOT}/pull.lock/owner.json`, JSON.stringify({ pid: process.pid }), { mode: 0o600, flag: 'wx' });
  const receipts = JSON.parse(ssh('list')).map(validateBackupReceipt);
  if (receipts.length > 32 || new Set(receipts.map(x => x.id)).size !== receipts.length) throw Error();
  const completed = [];
  for (const receipt of receipts) {
    const destination = `${ROOT}/${receipt.id}`;
    let exists = false; try { const info = await lstat(destination); if (!info.isDirectory() || info.isSymbolicLink()) throw Error(); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!exists) await mkdir(destination, { mode: 0o700 });
    let valid = false;
    try { const info = await lstat(`${destination}/snapshot.tar.age`); valid = info.isFile() && !info.isSymbolicLink() && info.size === receipt.bytes && await hashFile(`${destination}/snapshot.tar.age`) === receipt.sha256; if (!valid) throw Error(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!valid) {
      const disk = await statfs(ROOT); if (disk.bavail * disk.bsize < receipt.bytes + 2 * 1024 ** 3) throw Error();
      // A failed partial is retained under a unique name; it never becomes a successful receipt.
      const partial = `${destination}/snapshot-${Date.now()}.partial`;
      const child = spawn('/usr/bin/ssh', [...SSH, `get ${receipt.id}`], { stdio: ['ignore', 'pipe', 'pipe'] });
      child.stderr.resume(); const exit = new Promise(resolve => { child.once('error', () => resolve(-1)); child.once('close', resolve); });
      let bytes = 0; const hash = createHash('sha256');
      const counter = new Transform({ transform(chunk, _, callback) { bytes += chunk.length; if (bytes > receipt.bytes) { callback(Error()); return; } hash.update(chunk); callback(null, chunk); } });
      const timer = setTimeout(() => child.kill('SIGTERM'), 15 * 60 * 1000);
      try { await pipeline(child.stdout, counter, createWriteStream(partial, { flags: 'wx', mode: 0o600 })); if (await exit !== 0 || bytes !== receipt.bytes || hash.digest('hex') !== receipt.sha256) throw Error(); }
      finally { clearTimeout(timer); if (child.exitCode === null) child.kill('SIGTERM'); }
      await rename(partial, `${destination}/snapshot.tar.age`);
      await writeFile(`${destination}/receipt.json`, JSON.stringify(receipt), { mode: 0o600, flag: 'wx' });
    }
    try { await lstat(`${destination}/receipt.json`); } catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(`${destination}/receipt.json`, JSON.stringify(receipt), { mode: 0o600, flag: 'wx' }); }
    const saved = validateBackupReceipt(JSON.parse(await readFile(`${destination}/receipt.json`, 'utf8')));
    if (JSON.stringify(saved) !== JSON.stringify(receipt)) throw Error();
    if (JSON.parse(ssh(`ack ${receipt.id} ${receipt.sha256}`)).acknowledged !== true) throw Error();
    completed.push(receipt);
  }
  // Keep locally recovered history even after the server's shorter retention expires.
  const { readdir } = await import('node:fs/promises'); const local = [];
  for (const id of await readdir(ROOT)) {
    if (!/^[a-f0-9-]{36}$/u.test(id)) continue;
    const dir = `${ROOT}/${id}`, info = await lstat(dir); if (!info.isDirectory() || info.isSymbolicLink()) throw Error();
    try { const r = validateBackupReceipt(JSON.parse(await readFile(`${dir}/receipt.json`, 'utf8'))); if (r.id !== id) throw Error(); local.push(r); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  for (const id of selectBackupRetention(local, 30)) await rm(`${ROOT}/${id}`, { recursive: true });
  const latest = completed.at(-1); if (!latest) throw Error();
  const healthy = Date.now() - Date.parse(latest.createdAt) < 26 * 3600000;
  const state = { version: 1, checkedAt: new Date().toISOString(), healthy, availableSnapshots: local.length, latestId: latest.id, latestCreatedAt: latest.createdAt, plaintextStored: false };
  await writeFile(`${ROOT}/status.json.new`, JSON.stringify(state), { mode: 0o600 }); await rename(`${ROOT}/status.json.new`, `${ROOT}/status.json`);
  console.log(JSON.stringify(state)); if (!healthy) process.exitCode = 1;
} catch { console.error('{"error":"PRODUCTION_BACKUP_PULL_FAILED"}'); process.exitCode = 1; }
finally { if (locked) await rm(`${ROOT}/pull.lock`, { recursive: true }); }
