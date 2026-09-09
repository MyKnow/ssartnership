import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const compose = readFileSync(new URL("../deploy/self-host/compose.edge.yaml", import.meta.url), "utf8");
const caddyfile = readFileSync(new URL("../deploy/self-host/Caddyfile", import.meta.url), "utf8");

test("edge overlay pins an amd64-capable Caddy image and publishes only HTTP(S)", () => {
  assert.match(compose, /platform: linux\/amd64/u);
  assert.match(compose, /image: caddy:2\.11\.4@sha256:[a-f0-9]{64}/u);
  assert.match(compose, /- "80:80\/tcp"/u);
  assert.match(compose, /- "443:443\/tcp"/u);
  assert.match(compose, /- "443:443\/udp"/u);
  assert.match(compose, /cap_drop: \[ALL\]/u);
  assert.match(compose, /cap_add: \[NET_BIND_SERVICE\]/u);
  assert.match(compose, /no-new-privileges:true/u);
  assert.doesNotMatch(compose, /docker\.sock|admin-api|ADMIN_API/u);
});

test("edge overlay joins only the reviewed original Preview edge network", () => {
  assert.match(compose, /external: true/u);
  assert.match(compose, /name: ssartnership-original-preview-34141078185_edge/u);
  assert.match(compose, /- caddy-data:\/data/u);
  assert.match(compose, /- caddy-config:\/config/u);
  assert.match(compose, /Caddyfile:\/etc\/caddy\/Caddyfile:ro/u);
});

test("Caddy routes the fixed public origins to internal app and Supabase gateway", () => {
  assert.match(caddyfile, /ssartnership-dev\.myknow\.xyz\s*\{/u);
  assert.match(caddyfile, /ssartnership-api-dev\.myknow\.xyz\s*\{/u);
  assert.match(caddyfile, /reverse_proxy app:3000/u);
  assert.match(caddyfile, /reverse_proxy gateway:8000/u);
  assert.match(caddyfile, /max_size 64MB/u);
  assert.match(caddyfile, /admin off/u);
  assert.doesNotMatch(caddyfile, /tls internal|127\.0\.0\.1|localhost|http:\/\//u);
});

test("Caddy validation runbook supplies the executable for the entrypoint-free image", () => {
  const runbook = readFileSync(new URL("../docs/operations/runbooks/self-hosting.md", import.meta.url), "utf8");
  assert.match(runbook, /run --rm --entrypoint caddy caddy validate --config \/etc\/caddy\/Caddyfile --adapter caddyfile/u);
});
