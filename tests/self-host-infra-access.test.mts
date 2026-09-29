import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
test("infra routes require a mounted password hash before proxying", () => {
 const c = read("deploy/self-host/Caddyfile");
 assert.match(c, /basic_auth bcrypt infra/);
 assert.match(c, /import \/run\/infra-auth\/users/);
 assert.ok(c.indexOf("basic_auth bcrypt infra") < c.indexOf("reverse_proxy ssartnership-original-preview-prometheus-1:9090"));
 assert.match(c, /not method GET HEAD/);
 assert.match(c, /not header Sec-Fetch-Mode navigate/);
 assert.match(c, /X-Frame-Options "DENY"/);
 assert.match(c, /respond @unsafe_readonly 405/);
 assert.match(c, /header_up -Authorization/);
 assert.match(c, /header_up -Cookie/);
 assert.match(read("deploy/self-host/compose.edge.yaml"), /infra-auth:\/run\/infra-auth:ro/);
});
test("external paths preserve internal scrape routes and private bindings", () => {
 const c = read("deploy/self-host/compose.original-preview.yaml");
 for (const service of ["prometheus", "alertmanager"]) assert.ok(c.includes(`--web.external-url=https://ssartnership-infra-dev.myknow.xyz/infra/${service}/`));
 assert.equal(c.split("--web.route-prefix=/").length - 1, 2);
 assert.match(c, /GF_SERVER_ROOT_URL: https:\/\/ssartnership-infra-dev.myknow.xyz\/infra\/grafana\//);
 for (const port of ["59190:9090", "59193:9093", "53100:3000"]) assert.ok(c.includes(`127.0.0.1:${port}`));
 assert.doesNotMatch(c, /--web.enable-admin-api|--web.enable-lifecycle/);
});

test("infrastructure is isolated from the public Storage origin", () => {
 const c = read("deploy/self-host/Caddyfile");
 const api = c.split("ssartnership-api-dev.myknow.xyz {")[1].split("ssartnership-infra-dev.myknow.xyz {")[0];
 assert.match(api, /reverse_proxy gateway:8000/);
 assert.doesNotMatch(api, /basic_auth|infra|prometheus|grafana|alertmanager/);
});


test("shared edge monitoring upstreams cannot resolve to Production service aliases", () => {
 const c = read("deploy/self-host/Caddyfile");
 for (const [name, port] of [["prometheus", 9090], ["alertmanager", 9093], ["grafana", 3000]]) {
  assert.ok(c.includes(`reverse_proxy ssartnership-original-preview-${name}-1:${port}`));
  assert.ok(!c.includes(`reverse_proxy ${name}:${port}`));
 }
});
