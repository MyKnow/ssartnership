import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// 클라이언트 IP 신뢰 계약(리팩토링 기본 결정 21)의 배포 체인 쪽 전제를 고정한다.
// 앱 쪽 동작은 tests/security-hardening.test.mts가, 이 파일은 그 동작이 안전하게
// 성립하는 프록시·포트 구성을 검증한다. 체인을 바꾸면 src/lib/client-ip.ts와 함께 갱신한다.

const read = (relative: string) =>
  readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

function stripCaddyComments(source: string) {
  return source
    .split("\n")
    .map((line) => line.replace(/(^|\s)#.*$/u, "$1"))
    .join("\n");
}

test("relay Caddy trusts forwarded headers only from the single public edge hop", () => {
  const relay = stripCaddyComments(read("deploy/pve/relay.Caddyfile"));
  const trusted = [...relay.matchAll(/^\s*trusted_proxies\b(.*)$/gmu)].map((match) =>
    match[1].trim(),
  );

  assert.deepEqual(trusted, ["static {$OPS_VM_IP}/32"]);
  assert.match(relay, /^\s*trusted_proxies_strict\s*$/mu);
  assert.doesNotMatch(relay, /private_ranges|0\.0\.0\.0\/0|::\/0/u);
  // relay가 클라이언트 IP 헤더를 임의 값으로 덮어쓰지 않는다.
  assert.doesNotMatch(relay, /header_up\s+\+?X-Forwarded-For|header_up\s+\+?X-Real-IP/iu);
});

test("public edge Caddy never trusts client-sent forwarded headers", () => {
  const edge = stripCaddyComments(read("deploy/pve/edge.Caddyfile"));

  // trusted_proxies가 없으면 Caddy는 들어온 X-Forwarded-For를 버리고 접속 상대로 설정한다.
  assert.doesNotMatch(edge, /\btrusted_proxies\b/u);
  assert.doesNotMatch(edge, /\bclient_ip_headers\b/u);

  // 명시적 정규화를 추가할 때는 접속 상대 기준 값만 허용한다.
  for (const match of edge.matchAll(
    /header_up\s+\+?(X-Forwarded-For|X-Real-IP)\s+(\S+)/giu,
  )) {
    assert.match(
      match[2],
      /^\{(remote_host|http\.request\.remote\.host)\}$/u,
      `${match[1]} must be derived from the connection peer`,
    );
  }
});

test("app containers stay off public interfaces and run in the trusted proxy mode", () => {
  for (const relative of [
    "deploy/self-host/compose.production.yaml",
    "deploy/self-host/compose.original-preview.yaml",
  ]) {
    const compose = read(relative);
    const appBlock = compose.match(/\n  app:\n([\s\S]*?)(?=\n  [a-z][\w-]*:\n)/u)?.[1];
    assert.ok(appBlock, `${relative} app service`);
    assert.match(appBlock, /SELF_HOST_MODE:\s*real/u, relative);

    const ports = appBlock.match(/ports:\s*\[([^\]]*)\]/u)?.[1] ?? "";
    const bindings = [...ports.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
    assert.ok(bindings.length > 0, `${relative} app ports`);
    for (const binding of bindings) {
      assert.match(binding, /^127\.0\.0\.1:\d+:3000$/u, `${relative} ${binding}`);
    }
  }

  // relay는 게스트 LAN 주소에만 게시하고(방화벽이 엣지 VM만 허용), 앱 포트도 이 경로뿐이다.
  const relayCompose = read("deploy/pve/compose.relay.yaml");
  const relayPortsBlock = relayCompose.match(/\n    ports:\n((?:      - "[^"]+"\n)+)/u)?.[1] ?? "";
  const relayPorts = [...relayPortsBlock.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
  assert.ok(relayPorts.some((binding) => binding.endsWith(":${APP_PORT}:${APP_PORT}")));
  for (const binding of relayPorts) {
    assert.match(binding, /^\$\{PVE_RELAY_BIND_IP[:}]/u, binding);
  }
});

test("only the shared client IP helper reads client address headers", () => {
  const srcRoot = fileURLToPath(new URL("../src", import.meta.url));
  const allowed = new Set([join(srcRoot, "lib", "client-ip.ts")]);
  const forbidden =
    /["'`](x-forwarded-for|x-real-ip|x-vercel-forwarded-for|cf-connecting-ip|true-client-ip|x-client-ip)["'`]/iu;
  const offenders: string[] = [];

  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(ts|tsx|mts|js|mjs)$/u.test(entry) || /\.stories\.tsx?$/u.test(entry)) {
        continue;
      }
      if (!allowed.has(path) && forbidden.test(readFileSync(path, "utf8"))) {
        offenders.push(path.slice(srcRoot.length + 1));
      }
    }
  };
  walk(srcRoot);

  assert.deepEqual(offenders, []);

  const helper = read("src/lib/client-ip.ts");
  assert.match(helper, /export const CLIENT_IP_HEADER = 'x-forwarded-for';/u);
  assert.equal([...helper.matchAll(/headerStore\.get\(/gu)].length, 1);
  assert.match(helper, /headerStore\.get\(CLIENT_IP_HEADER\)/u);
  assert.doesNotMatch(helper, /process\.env\.VERCEL/u);
});
