import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildRequestErrorProperties,
  getRequestRouteGroup,
  normalizeRoutePattern,
  reportRequestError,
} from "../src/lib/request-error-report.ts";

test("request error properties use route patterns and fixed allowlists only", () => {
  assert.deepEqual(
    buildRequestErrorProperties(
      { path: "/partner/setup/private-token?code=secret", method: "post" },
      {
        routerKind: "App Router",
        routePath: "/app/partner/setup/[token]/page",
        routeType: "render",
        renderSource: "server-rendering",
        revalidateReason: undefined,
      },
    ),
    {
      routeGroup: "partner",
      route: "/partner/setup/[token]/page",
      path: "/partner/setup/[token]",
      method: "POST",
      routeType: "render",
      renderSource: "server-rendering",
      revalidateReason: null,
    },
  );
  const hostile = buildRequestErrorProperties(
    { path: "javascript:alert(1)", method: "BREW" },
    { routePath: "/app/<script>", routeType: "custom", renderSource: "other", revalidateReason: "x" },
  );
  assert.deepEqual(hostile, {
    routeGroup: "unknown",
    route: null,
    path: null,
    method: "OTHER",
    routeType: "unknown",
    renderSource: null,
    revalidateReason: null,
  });
  assert.equal(buildRequestErrorProperties(null, null).routeGroup, "unknown");
});

test("route groups collapse route-group folders and unknown segments", () => {
  assert.equal(normalizeRoutePattern("/src/app/admin/(protected)/page"), "/admin/(protected)/page");
  assert.equal(normalizeRoutePattern("/app"), "/");
  assert.equal(getRequestRouteGroup("/admin/(protected)/page"), "admin");
  assert.equal(getRequestRouteGroup("/(site)/partners/[id]/page"), "site");
  assert.equal(getRequestRouteGroup("/api/ready/route"), "api");
  assert.equal(getRequestRouteGroup("/"), "site");
  assert.equal(getRequestRouteGroup(null), "unknown");
});

test("reporting writes one JSON line with the digest and never throws", (t) => {
  const lines: string[] = [];
  t.mock.method(console, "error", (line: unknown) => { lines.push(String(line)); });
  const error = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "4083942417" });
  reportRequestError(error, { path: "/admin/members/member-uuid", method: "GET" }, { routePath: "/app/admin/(protected)/members/[memberId]/page", routeType: "render" });
  assert.doesNotThrow(() => reportRequestError(undefined, undefined, undefined));
  assert.equal(lines.length, 2);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.event, "[request-error] unhandled server error");
  assert.equal(entry.error.digest, "4083942417");
  assert.equal(entry.properties.path, "/admin/members/[memberId]");
  assert.equal(entry.properties.routeGroup, "admin");
});

test("instrumentation hook reports only in the Node.js runtime and swallows reporter failures", () => {
  const source = readFileSync(new URL("../src/instrumentation.ts", import.meta.url), "utf8");
  assert.match(source, /export const onRequestError: Instrumentation\.onRequestError/u);
  assert.match(source, /process\.env\.NEXT_RUNTIME !== "nodejs"/u);
  assert.match(source, /reportRequestError\(error, request, context\)/u);
  assert.match(source, /catch \{/u);
  assert.doesNotMatch(source, /fetch\(/u);
});

test("every error boundary shows the digest without rendering the raw message", () => {
  for (const file of ["../src/app/error.tsx", "../src/app/global-error.tsx", "../src/app/admin/(protected)/error.tsx"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /digest/u, file);
    assert.doesNotMatch(source, /error\.message/u, file);
  }
  const shared = readFileSync(new URL("../src/components/errors/AppErrorScreen.tsx", import.meta.url), "utf8");
  assert.match(shared, /<ErrorDigest digest=\{digest\} \/>/u);
});
