import assert from "node:assert/strict";
import https from "node:https";
import { readFile } from "node:fs/promises";
import { parseEnvText } from "../../scripts/self-host-operations/lib.mjs";

const [file, snapshot] = process.argv.slice(2);
if (!/^[a-f0-9]{64}$/u.test(snapshot ?? "")) throw new Error("full fixture snapshot ID required");
const env = parseEnvText(await readFile(file, "utf8"));
const ca = await readFile(env.OFFHOST_CA_FILE);
const authorization = `Basic ${Buffer.from(`${env.OFFHOST_USERNAME}:${env.OFFHOST_CREDENTIAL}`).toString("base64")}`;
function request(method, resource, { auth = true, trust = true } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(`https://127.0.0.1:58443/backup/ssartnership/${resource}`, { method, ...(trust ? { ca } : {}), headers: auth ? { authorization } : {}, timeout: 3000 }, (res) => { res.resume(); res.once("end", () => resolve(res.statusCode)); });
    req.once("error", reject);
    req.once("timeout", () => req.destroy(new Error("timeout")));
    req.end();
  });
}
assert.equal(await request("GET", "config", { auth: false }), 401);
await assert.rejects(() => request("GET", "config", { trust: false }));
assert.equal(await request("GET", "config"), 200);
assert.equal(await request("DELETE", `snapshots/${snapshot}`), 403);
assert.equal(await request("GET", `snapshots/${snapshot}`), 200);
process.stdout.write('{"unauthenticatedDenied":true,"untrustedCertificateDenied":true,"appendOnlyDeletionDenied":true,"snapshotRetained":true}\n');
