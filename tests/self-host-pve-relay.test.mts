import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('private relay fails closed before writes and changes only its own firewall rules', () => {
  execFileSync(process.platform === 'win32' ? 'python' : 'python3', [
    fileURLToPath(new URL('./fixtures/pve-relay-firewall.py', import.meta.url)),
    fileURLToPath(new URL('../deploy/pve/relay-firewall.py', import.meta.url)),
  ], { stdio: 'pipe', timeout: 15_000 });
});
