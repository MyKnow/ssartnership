#!/usr/bin/env node
import { readFile, writeFile, readdir, rename, lstat, chmod } from 'node:fs/promises';
import { validateBackupReceipt } from './production-backup-contract.mjs';
const ROOT = '/srv/ssartnership-backup-export';
const OUTPUT = '/etc/myknow/secrets/ssartnership-production/monitoring/textfile/production-backup.prom';
export function backupAcknowledgementMetrics(ack, receipts, now = Date.now()) {
  const record = receipts.find(r => r.id === ack?.id && r.sha256 === ack?.sha256);
  const timestamp = Date.parse(ack?.copiedAt);
  if (!record || !Number.isFinite(timestamp) || timestamp > now + 60000 || timestamp < Date.parse(record.createdAt)) return { copied: 0, created: 0 };
  return { copied: timestamp / 1000, created: Date.parse(record.createdAt) / 1000 };
}
async function collect() {
  if (process.getuid?.() !== 0) throw Error();
  let captured = 0;
  const receipts = [];
  for (const id of await readdir(ROOT)) {
    if (!/^[a-f0-9-]{36}$/u.test(id)) throw Error();
    const r = validateBackupReceipt(JSON.parse(await readFile(`${ROOT}/${id}/receipt.json`, 'utf8')));
    if (r.id !== id) throw Error(); receipts.push(r); captured = Math.max(captured, Date.parse(r.createdAt) / 1000);
  }
  const copies = {};
  for (const [name, filename] of [['mac', 'latest.json'], ['pve', 'latest-pve.json']]) {
    copies[name] = { copied: 0, created: 0 };
    try {
      const file = `/var/lib/ssartnership-backup-ack/${filename}`;
      const info = await lstat(file); if (!info.isFile() || info.isSymbolicLink() || info.size > 4096) throw Error();
      copies[name] = backupAcknowledgementMetrics(JSON.parse(await readFile(file, 'utf8')), receipts);
    } catch { /* Missing or invalid acknowledgement must remain visibly stale. */ }
  }
  const values = { collected: Date.now() / 1000, created: captured, mac_ack: copies.mac.copied, mac_created: copies.mac.created, pve_ack: copies.pve.copied, pve_created: copies.pve.created };
  const content = Object.entries(values).map(([name, value]) => `# TYPE ssartnership_production_backup_${name}_seconds gauge\nssartnership_production_backup_${name}_seconds ${value}\n`).join('');
  await writeFile(`${OUTPUT}.new`, content, { mode: 0o644 });
  await chmod(`${OUTPUT}.new`, 0o644); await rename(`${OUTPUT}.new`, OUTPUT);
}
import { fileURLToPath } from 'node:url';
import path from 'node:path';
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  collect().catch(() => { console.error('{"error":"PRODUCTION_BACKUP_METRICS_FAILED"}'); process.exitCode = 1; });
}
