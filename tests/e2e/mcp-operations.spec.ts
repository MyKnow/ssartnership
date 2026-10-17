import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const baseURL = process.env.BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`;
const qaDirectory = ".tmp/ui-qa/mcp";
const gatewayPassword = process.env.E2E_ADMIN_GATEWAY_PASSWORD
  ?? ["e2e", "admin", "gateway", "password", "minimum", "32", "chars"].join("-");

test.use({
  baseURL,
  httpCredentials: { username: process.env.E2E_ADMIN_GATEWAY_USERNAME ?? "e2e-admin-gateway", password: gatewayPassword },
});

async function hydrated(page: Page) {
  await expect(page.locator('[data-admin-hydrated="true"]').first()).toBeVisible({ timeout: 20_000 });
}

async function capture(page: Page, surface: string) {
  await mkdir(qaDirectory, { recursive: true });
  await hydrated(page);
  await page.evaluate(() => document.fonts.ready);
  for (const width of [360, 820, 1366]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `${qaDirectory}/${surface}-${width}.png`, fullPage: true, animations: "disabled", caret: "initial" });
  }
}

function resultData(result: Awaited<ReturnType<Client["callTool"]>>) {
  expect(result.isError).not.toBe(true);
  const block = result.content?.find(item => item.type === "text");
  expect(block?.type).toBe("text");
  const value = JSON.parse(block && "text" in block ? String(block.text) : "null");
  expect(value.ok).toBe(true);
  return value.data;
}

test.beforeEach(async ({ page }) => {
  // Reuse the existing compiler-gated, synthetic showcase fixture. No database or external links.
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(new URL(baseURL).hostname);
  const seed = await page.request.post("/api/e2e/mock/showcase-results", { data: { winner: "submitter" } });
  expect(seed.status()).toBe(200);
});

test.afterEach(async ({ page }) => {
  const reset = await page.request.post("/api/e2e/mock/showcase-results", { data: { winner: "reset" } });
  expect(reset.status()).toBe(200);
});

test("@critical remote MCP browser consent, scoped SDK reads, human approval, idempotency and revocation", async ({ page }) => {
  test.setTimeout(180_000);
  const appOrigin = new URL(baseURL).origin;
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(new URL(appOrigin).hostname);
  const consoleErrors: string[] = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  let callback: URL | null = null;
  const callbackServer = createServer((request, response) => {
    const incoming = new URL(request.url ?? "/", "http://127.0.0.1");
    if (incoming.pathname !== "/oauth/callback") { response.writeHead(204); response.end(); return; }
    callback = incoming;
    response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
    response.end("<!doctype html><title>Local MCP callback</title><p>Local OAuth callback received</p>");
  });
  await new Promise<void>(resolve => callbackServer.listen(0, "127.0.0.1", resolve));
  const address = callbackServer.address();
  if (!address || typeof address === "string") throw new Error("local_callback_unavailable");
  const redirectUri = `http://127.0.0.1:${address.port}/oauth/callback`;
  const sdk = new Client({ name: "ssartnership-browser-qa", version: "1.0.0" });
  try {
    await page.goto("/auth/mock?returnTo=%2Fadmin%2Fmcp");
    await expect(page).toHaveURL(`${appOrigin}/admin/mcp`);
    await hydrated(page);
    const clientName = `MCP 검증용 가상 클라이언트 ${randomBytes(3).toString("hex")}`;
    await page.getByLabel("AI 연결 이름").fill(clientName);
    await page.getByLabel("콜백 주소", { exact: true }).fill(redirectUri);
    await page.getByRole("button", { name: "클라이언트 등록", exact: true }).click();
    const registered = page.getByRole("article").filter({ has: page.getByRole("heading", { name: clientName, exact: true }) });
    await expect(registered).toHaveCount(1);
    const clientId = (await registered.innerText()).match(/클라이언트 ID: ([a-f0-9-]{36})/)?.[1];
    expect(clientId).toBeTruthy();
    await capture(page, "connections");
    const verifier = randomBytes(48).toString("base64url");
    const resource = `${appOrigin}/api/mcp`;
    const authorization = new URL(`${appOrigin}/admin/mcp/authorize`);
    authorization.search = new URLSearchParams({ client_id: clientId!, redirect_uri: redirectUri, response_type: "code", resource,
      scope: "catalog:read showcase:own-feedback:read showcase:moderate", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", state: "local-browser-state" }).toString();
    await page.goto(authorization.href);
    await hydrated(page);
    await expect(page.getByRole("heading", { name: `${clientName} 연결을 허용할까요?` })).toBeVisible();
    await capture(page, "authorize");
    await page.getByRole("button", { name: "연결 허용", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`^http://127\\.0\\.0\\.1:${address.port}/oauth/callback\\?`));
    expect(callback).not.toBeNull();
    const callbackResult = callback as URL | null;
    expect(callbackResult?.searchParams.get("state")).toBe("local-browser-state");
    expect(callbackResult?.searchParams.get("iss")).toBe(appOrigin);
    expect(consoleErrors.some(message => message.includes("form-action"))).toBe(false);
    const tokenResponse = await fetch(`${appOrigin}/api/mcp/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId!, code: callbackResult?.searchParams.get("code") ?? "", redirect_uri: redirectUri, code_verifier: verifier, grant_type: "authorization_code", resource }) });
    expect(tokenResponse.status).toBe(200);
    expect(tokenResponse.headers.get("cache-control")).toBe("no-store");
    const tokens = await tokenResponse.json() as { access_token: string };
    const transport = new StreamableHTTPClientTransport(new URL(resource), { authProvider: { token: async () => tokens.access_token } });
    await sdk.connect(transport);
    const tools = await sdk.listTools();
    expect(tools.tools.map(tool => tool.name).sort()).toEqual(["commit_feedback_visibility", "get_partner", "list_moderation_feedback", "list_own_feedback", "preview_feedback_visibility", "search_partners"]);
    const catalog = resultData(await sdk.callTool({ name: "search_partners", arguments: { limit: 1 } }));
    expect(catalog.items).toHaveLength(1);
    expect(catalog.items[0]).not.toHaveProperty("conditions");
    const own = resultData(await sdk.callTool({ name: "list_own_feedback", arguments: { projectId: "mock-showcase-study-buddy" } }));
    const body = "학습 기록과 일정 관리가 편리했어요. 모바일에서도 잘 보여요.";
    expect(own.items).toEqual([{ body }]);
    expect(JSON.stringify(own)).not.toContain("숨김 리뷰 본문");
    expect(JSON.stringify(own)).not.toContain("다른 출품자의 비공개 리뷰");
    const feedback = resultData(await sdk.callTool({ name: "list_moderation_feedback", arguments: {} }));
    const item = feedback.items.find((entry: { body: string }) => entry.body === body);
    expect(item).toBeTruthy();
    expect(item).not.toHaveProperty("createdAt");
    expect(item).not.toHaveProperty("memberId");
    const preview = resultData(await sdk.callTool({ name: "preview_feedback_visibility", arguments: { feedbackId: item.id, hidden: true } }));
    const unapproved = await sdk.callTool({ name: "commit_feedback_visibility", arguments: { reviewId: preview.reviewId } });
    expect(unapproved.isError).toBe(true);
    await page.goto(preview.approvalUrl);
    await hydrated(page);
    await expect(page.getByRole("blockquote")).toHaveText(body);
    await capture(page, "review");
    await page.getByRole("button", { name: "이 변경 승인", exact: true }).click();
    await expect(page.getByText("승인했어요. AI 앱으로 돌아가 실행을 요청해 주세요.")).toBeVisible();
    expect(resultData(await sdk.callTool({ name: "commit_feedback_visibility", arguments: { reviewId: preview.reviewId } })).status).toBe("executed");
    expect(resultData(await sdk.callTool({ name: "commit_feedback_visibility", arguments: { reviewId: preview.reviewId } })).status).toBe("replayed");
    const hidden = resultData(await sdk.callTool({ name: "list_moderation_feedback", arguments: { hidden: true } }));
    expect(hidden.items.some((entry: { id: string }) => entry.id === item.id)).toBe(true);
    await page.goto("/admin/mcp");
    await hydrated(page);
    await page.getByRole("button", { name: "연결 철회", exact: true }).click();
    await expect(page.getByText("연결한 AI 앱이 없어요. 등록한 앱에서 연결을 시작해 주세요.")).toBeVisible();
    const revoked = await fetch(resource, { method: "POST", headers: { authorization: `Bearer ${tokens.access_token}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
    expect(revoked.status).toBe(401);
    expect(revoked.headers.get("www-authenticate")).toContain("oauth-protected-resource/api/mcp");
    await page.goto(authorization.href);
    await hydrated(page);
    await page.getByRole("button", { name: "거절", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`^http://127\\.0\\.0\\.1:${address.port}/oauth/callback\\?`));
    expect(new URL(page.url()).searchParams.get("error")).toBe("access_denied");
    expect(new URL(page.url()).searchParams.has("code")).toBe(false);
    expect(new URL(page.url()).searchParams.get("iss")).toBe(appOrigin);
    await page.goto(authorization.href);
    await hydrated(page);
    // Exercise the native form endpoint without the enhanced onSubmit handler.
    // The host Next application itself requires scripts for streamed navigation.
    await page.locator('form[action="/api/mcp/consent"]').evaluate((form: HTMLFormElement) => {
      const decision = document.createElement("input");
      decision.type = "hidden"; decision.name = "decision"; decision.value = "allow";
      form.append(decision);
      HTMLFormElement.prototype.submit.call(form);
    });
    await expect(page.getByRole("heading", { name: "연결 요청을 처리했어요" })).toBeVisible();
    await page.getByRole("link", { name: "AI 앱으로 돌아가기" }).click();
    await expect(page).toHaveURL(new RegExp(`^http://127\\.0\\.0\\.1:${address.port}/oauth/callback\\?`));
    const nativeCode = new URL(page.url()).searchParams.get("code");
    expect(nativeCode).toBeTruthy();
    const exchanged = await fetch(`${appOrigin}/api/mcp/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId!, code: nativeCode!, redirect_uri: redirectUri, code_verifier: verifier, grant_type: "authorization_code", resource }) });
    expect(exchanged.status).toBe(200);
    const issued = await exchanged.json() as { access_token: string };
    const removed = await fetch(`${appOrigin}/api/mcp/oauth/revoke`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId!, token: issued.access_token }) });
    expect(removed.status).toBe(200);
    await writeFile(`${qaDirectory}/receipt.json`, JSON.stringify({ callbackReached: Boolean(callback), denialVerified: true, nativeFormFallbackVerified: true, cspFormActionErrors: consoleErrors.filter(message => message.includes("form-action")), viewportWidths: [360, 820, 1366], tools: tools.tools.map(tool => tool.name), humanApprovalRequired: unapproved.isError === true, commit: ["executed", "replayed"], revocationStatus: revoked.status, consoleErrors }, null, 2));
    expect(consoleErrors).toEqual([]);
  } finally {
    await sdk.close();
    await new Promise<void>((resolve, reject) => callbackServer.close(error => error ? reject(error) : resolve()));
  }
});
