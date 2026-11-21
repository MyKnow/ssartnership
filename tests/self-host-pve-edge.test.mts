import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { load } = require("js-yaml") as { load: (source: string) => unknown };
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
/** Drop whole-line comments so explanations never satisfy a directive check. */
const directives = (source: string) => source.replace(/^\s*#.*\n/gmu, "");

const edge = directives(read("deploy/pve/edge.Caddyfile"));
const relay = directives(read("deploy/pve/relay.Caddyfile"));

/** Return the balanced block that starts with `header {` at column 0; "" is the global options block. */
function block(source: string, header: string) {
  const opener = header ? `${header} {` : "{";
  const start = source.startsWith(opener) ? 0 : source.indexOf(`\n${opener}`);
  assert.notEqual(start, -1, `${header} block exists`);
  let depth = 0;
  for (let index = source.indexOf(opener, start) + opener.length - 1; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${header} block is unbalanced`);
}

function snippetBody(name: string) {
  const body = block(edge, `(${name})`);
  return body.slice(body.indexOf("{") + 1, -1);
}

/** Expand `import <snippet>` lines so a site is checked as Caddy runs it. */
function expanded(source: string): string {
  return source.replace(/^\s*import (\S+)\s*$/gmu, (line, name: string) => {
    if (!name.startsWith("ssartnership_")) return line;
    return expanded(snippetBody(name));
  });
}

const appOrigins = ["ssartnership.myknow.xyz", "ssartnership-dev.myknow.xyz"];
const apiOrigins = ["ssartnership-api.myknow.xyz", "ssartnership-api-dev.myknow.xyz"];
const hsts = 'header ?Strict-Transport-Security "max-age=63072000; includeSubDomains"';

test("public app and API origins share edge encoding, limits, HSTS and access logs", () => {
  for (const origin of [...appOrigins, ...apiOrigins]) {
    const site = expanded(block(edge, origin));
    assert.match(site, /encode zstd gzip/u, origin);
    assert.match(site, /max_size 64MB/u, origin);
    assert.ok(site.includes(hsts), `${origin} HSTS default`);
    assert.match(site, /log \{\s*output stdout/u, origin);
    assert.match(site, /wrap json/u, origin);
    assert.match(site, /reverse_proxy \S+:(?:3110|3108|8000) \{\s*header_up X-Real-IP \{remote_host\}\s*\}/u, origin);
  }
});

test("the finished migration gate no longer fails public origins closed", () => {
  // The edge Compose file still passes the old variable; it must stay inert.
  assert.doesNotMatch(edge, /PVE_PUBLIC_SERVICES_READY|final_snapshot_gate|respond @preparing/u);
  for (const origin of [...appOrigins, ...apiOrigins]) {
    assert.doesNotMatch(expanded(block(edge, origin)), /\b503\b/u, origin);
  }
});

test("the edge replaces client forwarding headers and the relay trusts only that hop", () => {
  // Without trusted_proxies Caddy discards a client X-Forwarded-For and sends
  // the connection address; X-Real-IP is overwritten explicitly.
  assert.doesNotMatch(edge, /trusted_proxies/u);
  assert.doesNotMatch(edge, /header_up\s+[+-]?X-Forwarded-For/u);
  assert.match(relay, /trusted_proxies static \{\$OPS_VM_IP\}\/32/u);
  assert.match(relay, /trusted_proxies_strict/u);
});

test("cron and readiness routes are not public on either app origin", () => {
  for (const origin of appOrigins) {
    const site = expanded(block(edge, origin));
    assert.match(site, /@internal_only path \/api\/cron \/api\/cron\/\* \/api\/ready \/api\/ready\/\*/u, origin);
    assert.match(site, /respond @internal_only 404/u, origin);
  }
  for (const origin of apiOrigins) {
    assert.doesNotMatch(expanded(block(edge, origin)), /@internal_only/u, origin);
  }
});

test("access logs mask client networks and drop credentials and one-time tokens", () => {
  const log = snippetBody("ssartnership_access_log");
  for (const field of ["request>remote_ip", "request>client_ip"]) {
    assert.match(log, new RegExp(`${field} ip_mask 24 48`, "u"));
  }
  // Apikey carries Supabase keys (operator scripts send the service role key);
  // client-sent forwarding headers would bypass the address mask.
  for (const field of [
    "request>headers>Cookie",
    "request>headers>Authorization",
    "request>headers>Proxy-Authorization",
    "request>headers>Apikey",
    "request>headers>X-Forwarded-For",
    "request>headers>X-Real-Ip",
    "request>headers>Referer",
    "resp_headers>Set-Cookie",
    "resp_headers>Location",
  ]) {
    assert.match(log, new RegExp(`${field} delete`, "u"));
  }
  const [, pattern, replacement] = log.match(/request>uri regexp "([^"]+)" "([^"]+)"/u) ?? [];
  assert.ok(pattern && replacement, "URI filter exists");
  // Caddy uses Go's ReplaceAllString; translate ${n} to JavaScript's $n.
  const redact = (uri: string) => uri.replace(new RegExp(pattern, "gu"), replacement.replace(/\$\{(\d+)\}/gu, "$$$1"));
  assert.equal(redact("/verify/abc?x=1"), "/verify/redacted?redacted");
  assert.equal(redact("/api/partner/setup/abc/next"), "/api/partner/setup/redacted/next");
  assert.equal(redact("/partners/12?preview=secret"), "/partners/12?redacted");
  assert.equal(redact("/partners/12"), "/partners/12");

  // Every App Router segment named [token] must be redacted in edge logs.
  const tokenRoutes: string[] = [];
  const walk = (directory: URL, segments: string[]) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const next = [...segments, entry.name];
      if (entry.name === "[token]") tokenRoutes.push(`/${next.filter((segment) => !/^\(.+\)$/u.test(segment)).join("/")}`);
      walk(new URL(`${entry.name}/`, directory), next);
    }
  };
  walk(new URL("../src/app/", import.meta.url), []);
  assert.ok(tokenRoutes.length >= 5, "token routes discovered");
  for (const route of tokenRoutes) {
    const uri = route.replace("[token]", "one-time-secret");
    assert.doesNotMatch(redact(uri), /one-time-secret/u, route);
  }
});

test("Caddy metrics are served only by the private-range scrape listener", () => {
  assert.match(block(edge, ""), /\n\tmetrics\n/u);
  assert.doesNotMatch(block(edge, ""), /per_host/u);
  const listener = block(edge, "http://:9180");
  const external = listener.indexOf("@external not remote_ip private_ranges");
  const rejected = listener.indexOf("respond @external 403");
  const served = listener.indexOf("metrics /metrics");
  assert.ok(external !== -1 && external < rejected && rejected < served, "reject before serving");
  assert.match(listener, /route \{/u);
  for (const origin of [...appOrigins, ...apiOrigins, "ssartnership-infra.myknow.xyz"]) {
    assert.doesNotMatch(expanded(block(edge, origin)), /^\s*metrics\b/mu, origin);
  }
  const operations = load(read("deploy/pve/compose.operations.yaml")) as { services: { caddy: { ports: string[] } } };
  assert.deepEqual(operations.services.caddy.ports, ["80:80/tcp", "443:443/tcp", "443:443/udp"]);
});

test("API and infrastructure origins also default to HSTS", () => {
  for (const origin of ["ssartnership-infra.myknow.xyz", "ssartnership-infra-dev.myknow.xyz"]) {
    assert.ok(block(edge, origin).includes(hsts), origin);
  }
});

test("the edge runbook validates the PVE edge with the entrypoint-free Caddy image", () => {
  const runbook = read("docs/operations/runbooks/self-hosting.md");
  assert.match(runbook, /-f deploy\/pve\/compose\.operations\.yaml run --rm --entrypoint caddy caddy validate --config \/etc\/caddy\/Caddyfile --adapter caddyfile/u);
  // The laptop-era same-host overlay was removed; no command may target it.
  assert.doesNotMatch(runbook, /-f deploy\/self-host\/compose\.edge\.yaml/u);
  for (const path of ["deploy/self-host/Caddyfile", "deploy/self-host/Caddyfile.production", "deploy/self-host/compose.edge.yaml"]) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, path);
  }
});
