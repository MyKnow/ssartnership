import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { root, run } from "../../scripts/self-host-environments/cli.mjs";
import { loadPair } from "../../scripts/self-host-environments/lib.mjs";
const dir = path.resolve(process.argv[2]);
assert.ok(dir.startsWith(path.join(root, ".tmp", "dual-environments-")));
const pair = await loadPair(dir);
const headers = [];
for (const role of ["production", "preview"]) {
  for (const route of ["/", "/auth/login", "/api/health"]) {
    const response = await fetch(`${pair[role].runtime.NEXT_PUBLIC_SITE_URL}${route}`, { redirect: "error", signal: AbortSignal.timeout(15_000) });
    assert.equal(response.status, 200);
    await response.arrayBuffer();
    headers.push({ role, route, status: response.status });
  }
}
const container = `${pair.preview.project}-app-1`;
const inspected = JSON.parse((await run("docker", ["inspect", container])).stdout)[0];
assert.deepEqual(Object.keys(inspected.NetworkSettings.Networks), [`${pair.preview.project}_private`]);
assert.equal(Object.keys(inspected.HostConfig.PortBindings ?? {}).length, 0);
const prodDb = JSON.parse((await run("docker", ["inspect", `${pair.production.project}-db-1`])).stdout)[0];
const prodIp = prodDb.NetworkSettings.Networks[`${pair.production.project}_private`].IPAddress;
const probe = `const net=require('node:net'); const [host,port]=process.argv.slice(1); const s=net.connect({host,port:Number(port)}); s.setTimeout(2500); s.on('connect',()=>{console.log('connected');s.destroy()});s.on('error',()=>console.log('blocked'));s.on('timeout',()=>{console.log('blocked');s.destroy()});`;
const own = (await run("docker", ["exec", container, "node", "-e", probe, "db", "5432"])).stdout.trim();
assert.equal(own, "connected");
for (const [host, port] of [[prodIp, "5432"], ["1.1.1.1", "443"]]) {
  const result = (await run("docker", ["exec", container, "node", "-e", probe, host, port])).stdout.trim();
  assert.equal(result, "blocked");
}
const proof = { syntheticOnly: true, endpoints: headers, separateBrowserHosts: new URL(pair.production.runtime.NEXT_PUBLIC_SITE_URL).hostname !== new URL(pair.preview.runtime.NEXT_PUBLIC_SITE_URL).hostname, ownDatabaseReachable: true, productionDatabaseBlocked: true, externalTcpBlocked: true, verifiedAt: new Date().toISOString() };
await writeFile(path.join(dir, "isolation-proof.json"), JSON.stringify(proof), { mode: 0o600, flag: "wx" });
console.log(JSON.stringify(proof));
