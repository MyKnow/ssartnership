#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { createDatabaseEnvironment, renderEnvironmentFile } from '/srv/build-lab-497/source/scripts/self-host-database/lib.mjs';
import { createLocalRuntimeEnvironment } from '/srv/build-lab-497/source/deploy/self-host/write-local-runtime-env.mjs';

try {
  if (process.getuid() !== 0 || hostname() !== 'ssartnership-preview-lab') throw new Error('WRONG_GUEST');
  const root = '/etc/myknow/secrets/ssartnership-lab-497';
  await mkdir('/etc/myknow/secrets', { recursive: true, mode: 0o700 });
  // Exclusive creation prevents overwriting even this synthetic database's identity.
  await mkdir(root, { mode: 0o700 });
  const data = createDatabaseEnvironment({ project: 'ssartnership-lab-497', port: '54321' });
  const app = createLocalRuntimeEnvironment(data);
  await writeFile(`${root}/data.env`, renderEnvironmentFile(data), { mode: 0o600, flag: 'wx' });
  await writeFile(`${root}/app.env`, Object.entries(app).map(([key,value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  console.log('{"initialized":true,"environment":"synthetic-lab","productionCredentials":false}');
} catch {
  console.error('{"error":"LAB_PREVIEW_INITIALIZATION_FAILED"}');
  process.exitCode = 1;
}
