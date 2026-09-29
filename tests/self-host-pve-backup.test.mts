import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('PVE backup refuses unsafe receipts, symlinks, missing mounts and wrong disk identity', () => {
  execFileSync(process.platform === 'win32' ? 'python' : 'python3', [
    fileURLToPath(new URL('./fixtures/pve-backup-contract.py', import.meta.url)),
    fileURLToPath(new URL('../scripts/self-host-operations/pve-backup-pull.py', import.meta.url)),
  ], { stdio: 'pipe', timeout: 15_000 });
});
