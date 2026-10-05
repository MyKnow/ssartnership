import { lstat, open, realpath, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const outside = (root, path) => { const rel = relative(root, path); return rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel); };

export async function exportRecoveryIdentity({ source, destination, root = repositoryRoot, now = new Date() }) {
  if (!isAbsolute(source) || !isAbsolute(destination)) throw new Error('ESCROW_ABSOLUTE_PATH_REQUIRED');
  const parent = dirname(destination);
  const [sourceStat, parentStat, actualSource, actualParent, actualRoot] = await Promise.all([
    lstat(source), lstat(parent), realpath(source), realpath(parent), realpath(root),
  ]);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || sourceStat.size > 4096 || (sourceStat.mode & 0o077)
    || !parentStat.isDirectory() || parentStat.isSymbolicLink() || (parentStat.mode & 0o077)
    || actualSource !== resolve(source) || actualParent !== resolve(parent)
    || !outside(actualRoot, actualSource) || !outside(actualRoot, destination)) throw new Error('ESCROW_PRIVATE_PATH_REQUIRED');
  const owner = process.getuid?.();
  if (owner !== undefined && (sourceStat.uid !== owner || parentStat.uid !== owner)) throw new Error('ESCROW_PRIVATE_PATH_REQUIRED');
  const handle = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  let text;
  try {
    const current = await handle.stat();
    if (!current.isFile() || current.ino !== sourceStat.ino || current.dev !== sourceStat.dev || current.size > 4096 || (current.mode & 0o077)) throw new Error('ESCROW_PRIVATE_PATH_REQUIRED');
    text = await handle.readFile('utf8');
  } finally { await handle.close(); }
  const identities = text.split(/\r?\n/u).filter((line) => line.trim() && !line.startsWith('#'));
  if (identities.length !== 1 || !/^AGE-SECRET-KEY-[A-Z0-9]{58}$/u.test(identities[0])) throw new Error('ESCROW_IDENTITY_FORMAT_INVALID');
  await writeFile(destination, JSON.stringify({ version: 1, kind: 'age-recovery-identity', exportedAt: now.toISOString(), identity: identities[0] }) + '\n', { flag: 'wx', mode: 0o600 });
  return { exported: true, version: 1 };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  try {
    const result = await exportRecoveryIdentity({ source: process.argv[2], destination: process.argv[3] });
    console.log(JSON.stringify(result));
  } catch {
    console.error('ESCROW_EXPORT_FAILED');
    process.exitCode = 1;
  }
}
