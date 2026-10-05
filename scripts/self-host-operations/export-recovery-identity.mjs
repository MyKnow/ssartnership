import { lstat, open, realpath, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const outside = (root, path) => { const rel = relative(root, path); return rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel); };

// The fixed X25519 identity is a Bech32 HRP, separator, 52 data symbols
// (32 bytes plus four zero padding bits), and six checksum symbols.
// https://github.com/C2SP/C2SP/blob/main/age.md#the-x25519-recipient-type
// Check the checksum and padding as well as length: accepting a damaged key
// would let an operator seal a copy that cannot decrypt any backup.
function validateIdentity(identity) {
  if (typeof identity !== 'string' || !/^AGE-SECRET-KEY-1[QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L]{58}$/u.test(identity)) {
    throw new Error('ESCROW_IDENTITY_FORMAT_INVALID');
  }
  const alphabet = 'QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L';
  const symbols = [...identity.slice(16)].map((character) => alphabet.indexOf(character));
  const prefix = [...Buffer.from('age-secret-key-', 'ascii')];
  const values = [...prefix.map((value) => value >>> 5), 0, ...prefix.map((value) => value & 31), ...symbols];
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let checksum = 1;
  for (const value of values) {
    const highBits = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    for (let bit = 0; bit < generators.length; bit += 1) {
      if (highBits & (1 << bit)) checksum ^= generators[bit];
    }
  }
  if (checksum !== 1 || (symbols[51] & 15) !== 0) throw new Error('ESCROW_IDENTITY_FORMAT_INVALID');
  return identity;
}

async function readPrivateSource({ source, destination, root }) {
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
  return text;
}

export async function exportRecoveryIdentity({ source, destination, root = repositoryRoot, now = new Date() }) {
  const text = await readPrivateSource({ source, destination, root });
  const identities = text.split(/\r?\n/u).filter((line) => line.trim() && !line.startsWith('#'));
  if (identities.length !== 1) throw new Error('ESCROW_IDENTITY_FORMAT_INVALID');
  const identity = validateIdentity(identities[0]);
  await writeFile(destination, JSON.stringify({ version: 1, kind: 'age-recovery-identity', exportedAt: now.toISOString(), identity }) + '\n', { flag: 'wx', mode: 0o600 });
  return { exported: true, version: 1 };
}

/** Materialize a sealed JSON copy for age -i in an approved private directory. */
export async function importRecoveryIdentity({ source, destination, root = repositoryRoot }) {
  const text = await readPrivateSource({ source, destination, root });
  let envelope;
  try { envelope = JSON.parse(text); } catch { throw new Error('ESCROW_ENVELOPE_FORMAT_INVALID'); }
  if (!envelope || Object.keys(envelope).sort().join() !== 'exportedAt,identity,kind,version'
    || envelope.version !== 1 || envelope.kind !== 'age-recovery-identity'
    || typeof envelope.exportedAt !== 'string' || !Number.isFinite(Date.parse(envelope.exportedAt))
    || new Date(envelope.exportedAt).toISOString() !== envelope.exportedAt) throw new Error('ESCROW_ENVELOPE_FORMAT_INVALID');
  const identity = validateIdentity(envelope.identity);
  await writeFile(destination, `${identity}\n`, { flag: 'wx', mode: 0o600 });
  return { imported: true, version: 1 };
}

if (process.argv[1] && process.argv[1] !== '-' && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const importing = args[0] === '--import';
    if (args.length !== (importing ? 3 : 2)) throw new Error('ESCROW_ARGUMENTS_INVALID');
    const [source, destination] = importing ? args.slice(1) : args;
    const operation = importing ? importRecoveryIdentity : exportRecoveryIdentity;
    const result = await operation({ source, destination });
    console.log(JSON.stringify(result));
  } catch {
    console.error('ESCROW_EXPORT_FAILED');
    process.exitCode = 1;
  }
}
