#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const TARGETS = Object.freeze([
  { environment: 'production', url: 'https://ssartnership.myknow.xyz/api/health', status: 200 },
  { environment: 'preview', url: 'https://ssartnership-dev.myknow.xyz/api/health', status: 200 },
  { environment: 'production-infra', url: 'https://ssartnership-infra.myknow.xyz/infra/prometheus/', status: 401 },
  { environment: 'preview-infra', url: 'https://ssartnership-infra-dev.myknow.xyz/infra/prometheus/', status: 401 },
]);

export async function verifyPublicHealth(fetchImpl = fetch) {
  const results = [];
  for (const target of TARGETS) {
    try {
      const response = await fetchImpl(target.url, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: { accept: 'application/json', 'cache-control': 'no-cache' },
      });
      if (response.status !== target.status) { await response.body?.cancel(); throw Error(); }
      if (target.status === 401) {
        await response.body?.cancel();
        if (!/^Basic\s/iu.test(response.headers.get('www-authenticate') ?? '')) throw Error();
      } else {
        if (!response.headers.get('content-type')?.startsWith('application/json') || !response.headers.get('cache-control')?.includes('no-store') || !response.body) throw Error();
        const reader = response.body.getReader();
        const chunks = [];
        let size = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 4096) throw Error();
            chunks.push(value);
          }
        } finally { await reader.cancel().catch(() => {}); }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!body || Object.keys(body).join() !== 'status' || body.status !== 'ok') throw Error();
      }
      results.push({ environment: target.environment, status: target.status, passed: true });
    } catch { results.push({ environment: target.environment, passed: false, error: 'PUBLIC_HEALTH_CHECK_FAILED' }); }
  }
  return results;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = await verifyPublicHealth();
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }));
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
