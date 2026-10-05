import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
test("infra routes require a mounted password hash before proxying", () => {
 const c = read("deploy/pve/edge.Caddyfile");
 const infra = c.slice(c.indexOf("\nssartnership-infra.myknow.xyz {"), c.indexOf("\nclayfarm.myknow.xyz {"));
 assert.match(infra, /basic_auth bcrypt infra/);
 assert.match(infra, /import \/run\/production-infra-auth\/users/);
 assert.ok(infra.indexOf("basic_auth bcrypt infra") < infra.indexOf("reverse_proxy prometheus:9090"));
 assert.match(infra, /not method GET HEAD/);
 assert.match(infra, /not header Sec-Fetch-Mode navigate/);
 assert.match(infra, /X-Frame-Options "DENY"/);
 assert.match(infra, /respond @unsafe_readonly 405/);
 assert.match(infra, /header_up -Authorization/);
 assert.match(infra, /header_up -Cookie/);
 assert.match(read("deploy/pve/compose.operations.yaml"), /infra-auth:\/run\/production-infra-auth:ro/);
});
test("external paths preserve internal scrape routes and private bindings", () => {
 const c = read("deploy/self-host/compose.original-preview.yaml");
 for (const service of ["prometheus", "alertmanager"]) assert.ok(c.includes(`--web.external-url=https://ssartnership-infra-dev.myknow.xyz/infra/${service}/`));
 assert.equal(c.split("--web.route-prefix=/").length - 1, 2);
 assert.match(c, /GF_SERVER_ROOT_URL: https:\/\/ssartnership-infra-dev.myknow.xyz\/infra\/grafana\//);
 for (const port of ["59190:9090", "59193:9093", "53100:3000"]) assert.ok(c.includes(`127.0.0.1:${port}`));
 assert.doesNotMatch(c, /--web.enable-admin-api|--web.enable-lifecycle/);
});

test("infrastructure is isolated from the public Storage origins", () => {
 const c = read("deploy/pve/edge.Caddyfile");
 for (const [origin, next] of [["ssartnership-api.myknow.xyz", "ssartnership-api-dev.myknow.xyz"], ["ssartnership-api-dev.myknow.xyz", "ssartnership-infra-dev.myknow.xyz"]]) {
  const api = c.split(`${origin} {`)[1].split(`${next} {`)[0];
  assert.match(api, /reverse_proxy \S+:8000/);
  assert.doesNotMatch(api, /basic_auth|infra|prometheus|grafana|alertmanager/);
 }
});

test("shared edge monitoring upstreams resolve only to operations VM services", () => {
 const c = read("deploy/pve/edge.Caddyfile");
 const infra = c.slice(c.indexOf("\nssartnership-infra.myknow.xyz {"), c.indexOf("\nclayfarm.myknow.xyz {"));
 const upstreams = [...infra.matchAll(/reverse_proxy (\S+)/gu)].map((match) => match[1]).sort();
 assert.deepEqual(upstreams, ["alertmanager:9093", "grafana:3000", "notifier:9465", "prometheus:9090"]);
});
