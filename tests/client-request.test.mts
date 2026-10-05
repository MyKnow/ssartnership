import assert from "node:assert/strict";
import test from "node:test";
import { ClientRequestError, isJsonRecord, requestJson } from "../src/lib/client-request.ts";

const options = { fallbackMessage: "요청을 처리하지 못했습니다.", parse: (value: unknown) => isJsonRecord(value) ? value : null };

test("JSON request preserves a safe server message and validates the success shape", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ message: "다시 인증해 주세요." }), { status: 403 }));
  await assert.rejects(requestJson("https://example.test", {}, options), (error: unknown) => error instanceof ClientRequestError && error.status === 403 && error.message === "다시 인증해 주세요.");
  t.mock.method(globalThis, "fetch", async () => new Response("[]"));
  await assert.rejects(requestJson("https://example.test", {}, options), { message: options.fallbackMessage });
});

test("non-JSON responses use the fallback and abort errors keep their identity", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("upstream internals", { status: 502 }));
  await assert.rejects(requestJson("https://example.test", {}, options), { message: options.fallbackMessage });
  const abort = new DOMException("aborted", "AbortError");
  t.mock.method(globalThis, "fetch", async () => { throw abort; });
  await assert.rejects(requestJson("https://example.test", {}, options), (error: unknown) => error === abort);
});
