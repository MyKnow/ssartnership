// Explicit synthetic HTTPS receiver for end-to-end Alertmanager tests.
import https from "node:https";
import { readFileSync } from "node:fs";
const [certificate, key] = process.argv.slice(2);
if (!certificate || !key) throw new Error("fixture requires certificate and key paths");
const receipt = { accepted: 0, invalid: 0, firing: 0, resolved: 0 };
const server = https.createServer({ cert: readFileSync(certificate), key: readFileSync(key) }, async (req, res) => {
  if (req.method === "GET" && req.url === "/status") { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(receipt)); return; }
  if (req.method !== "POST" || req.url !== "/webhook") { res.writeHead(404); res.end(); return; }
  let body = "";
  for await (const chunk of req) { body += chunk; if (body.length > 8192) break; }
  try {
    const parsed = JSON.parse(body);
    if (Object.keys(parsed).length !== 1 || typeof parsed.text !== "string" || !parsed.text.startsWith("[ssartnership] ")) throw new Error("invalid");
    receipt.accepted += 1;
    if (parsed.text.includes("firing: SyntheticAlert")) receipt.firing += 1;
    if (parsed.text.includes("resolved: SyntheticAlert")) receipt.resolved += 1;
    res.writeHead(204); res.end();
  } catch { receipt.invalid += 1; res.writeHead(400); res.end(); }
});
server.listen(58445, "127.0.0.1", () => process.stdout.write('{"fixtureReady":true}\n'));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
