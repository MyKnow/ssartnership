#!/usr/bin/env node
import { open, readFile, readdir, lstat, writeFile, rename, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { parseBackupCommand, validateBackupReceipt } from './production-backup-contract.mjs';
const ROOT = '/srv/ssartnership-backup-export';
const ACK = '/var/lib/ssartnership-backup-ack/latest.json';
async function receipt(id) {
  const directory = `${ROOT}/${id}`;
  if (await realpath(directory) !== directory || (await lstat(directory)).uid !== 0) throw Error();
  const value = validateBackupReceipt(JSON.parse(await readFile(`${directory}/receipt.json`, 'utf8')));
  if (value.id !== id) throw Error();
  return value;
}
try {
  if (process.getuid?.() === 0 || process.argv.length !== 2) throw Error();
  const request = parseBackupCommand(process.env.SSH_ORIGINAL_COMMAND);
  if (request.command === 'list') {
    const rows = [];
    for (const id of await readdir(ROOT)) {
      if (!/^[a-f0-9-]{36}$/u.test(id)) throw Error();
      rows.push(await receipt(id));
    }
    if (rows.length > 32) throw Error();
    console.log(JSON.stringify(rows.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))));
  } else {
    const value = await receipt(request.id);
    if (request.command === 'get') {
      const file = await open(`${ROOT}/${request.id}/snapshot.tar.age`, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { const info = await file.stat(); if (!info.isFile() || info.uid !== 0 || info.size !== value.bytes) throw Error(); await pipeline(file.createReadStream(), process.stdout); }
      finally { await file.close(); }
    } else {
      if (request.sha256 !== value.sha256) throw Error();
      await writeFile(`${ACK}.new`, JSON.stringify({ version: 1, id: value.id, sha256: value.sha256, copiedAt: new Date().toISOString(), backupCreatedAt: value.createdAt }), { mode: 0o600 });
      await rename(`${ACK}.new`, ACK); console.log('{"acknowledged":true}');
    }
  }
} catch { console.error('{"error":"BACKUP_ACCESS_DENIED"}'); process.exitCode = 1; }
