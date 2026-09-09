#!/usr/bin/env node
import { readFile, writeFile, readdir, rename, lstat } from 'node:fs/promises';
import { validateBackupReceipt } from './production-backup-contract.mjs';
const ROOT = '/srv/ssartnership-backup-export';
const OUTPUT = '/etc/myknow/secrets/ssartnership-production/monitoring/textfile/production-backup.prom';
try {
  if (process.getuid?.() !== 0) throw Error();
  let captured = 0, copied = 0, copiedBackup = 0;
  const receipts = [];
  for (const id of await readdir(ROOT)) {
    if (!/^[a-f0-9-]{36}$/u.test(id)) throw Error();
    const r = validateBackupReceipt(JSON.parse(await readFile(`${ROOT}/${id}/receipt.json`, 'utf8')));
    if (r.id !== id) throw Error(); receipts.push(r); captured = Math.max(captured, Date.parse(r.createdAt) / 1000);
  }
  try {
    const file = '/var/lib/ssartnership-backup-ack/latest.json';
    const info = await lstat(file); if (!info.isFile() || info.isSymbolicLink() || info.size > 4096) throw Error();
    const ack = JSON.parse(await readFile(file, 'utf8'));
    const record = receipts.find(r => r.id === ack.id && r.sha256 === ack.sha256);
    const timestamp = Date.parse(ack.copiedAt);
    if (record && Number.isFinite(timestamp) && timestamp <= Date.now() + 60000 && timestamp >= Date.parse(record.createdAt)) { copied = timestamp / 1000; copiedBackup = Date.parse(record.createdAt) / 1000; }
  } catch { /* Missing/invalid acknowledgement must remain visibly stale. */ }
  const content = `# HELP ssartnership_production_backup_collected_seconds Time backup status was collected.\n# TYPE ssartnership_production_backup_collected_seconds gauge\nssartnership_production_backup_collected_seconds ${Date.now() / 1000}\n# TYPE ssartnership_production_backup_created_seconds gauge\nssartnership_production_backup_created_seconds ${captured}\n# TYPE ssartnership_production_backup_mac_ack_seconds gauge\nssartnership_production_backup_mac_ack_seconds ${copied}\n# TYPE ssartnership_production_backup_mac_created_seconds gauge\nssartnership_production_backup_mac_created_seconds ${copiedBackup}\n`;
  await writeFile(`${OUTPUT}.new`, content, { mode: 0o644 });
  // This dedicated non-secret textfile must survive a restrictive root umask.
  const { chmod } = await import('node:fs/promises'); await chmod(`${OUTPUT}.new`, 0o644); await rename(`${OUTPUT}.new`, OUTPUT);
} catch { console.error('{"error":"PRODUCTION_BACKUP_METRICS_FAILED"}'); process.exitCode = 1; }
