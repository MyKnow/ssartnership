#!/usr/bin/env node
import { open, readdir, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { parseBackupCommand, validateBackupReceipt } from './production-backup-contract.mjs';
import { recordBackupAcknowledgement, backupFailureDiagnostic } from './production-backup-ack.mjs';
const ROOT = '/srv/ssartnership-backup-export';
async function receipt(id) {
  const directory = `${ROOT}/${id}`;
  if (await realpath(directory) !== directory || (await lstat(directory)).uid !== 0) throw Error();
  const file = await open(`${directory}/receipt.json`, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let value;
  try {
    const info = await file.stat();
    if (!info.isFile() || info.uid !== 0 || info.size > 4096) throw Error();
    value = validateBackupReceipt(JSON.parse(await file.readFile('utf8')));
  } finally { await file.close(); }
  if (value.id !== id) throw Error();
  return value;
}
let stage = 'request';
try {
  if (process.getuid?.() === 0 || process.argv.length !== 2) throw Error();
  const request = parseBackupCommand(process.env.SSH_ORIGINAL_COMMAND);
  if (request.command === 'list') {
    stage = 'list';
    const rows = [];
    for (const id of await readdir(ROOT)) {
      if (!/^[a-f0-9-]{36}$/u.test(id)) throw Error();
      rows.push(await receipt(id));
    }
    if (rows.length > 32) throw Error();
    console.log(JSON.stringify(rows.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))));
  } else {
    stage = 'receipt';
    const value = await receipt(request.id);
    if (request.command === 'get') {
      stage = 'download';
      const file = await open(`${ROOT}/${request.id}/snapshot.tar.age`, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { const info = await file.stat(); if (!info.isFile() || info.uid !== 0 || info.size !== value.bytes) throw Error(); await pipeline(file.createReadStream(), process.stdout); }
      finally { await file.close(); }
    } else {
      stage = 'acknowledgement';
      if (request.sha256 !== value.sha256) throw Error();
      await recordBackupAcknowledgement(value, request.command);
      console.log('{"acknowledged":true}');
    }
  }
} catch (error) { console.error(JSON.stringify({ error: 'BACKUP_ACCESS_DENIED', ...backupFailureDiagnostic(error, stage) })); process.exitCode = 1; }
