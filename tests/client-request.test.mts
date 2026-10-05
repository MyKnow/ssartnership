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

test("aborting a response body preserves the original AbortError", async (t) => {
  const abort = new DOMException("body aborted", "AbortError");
  const response = new Response("{}");
  t.mock.method(response, "json", async () => { throw abort; });
  t.mock.method(globalThis, "fetch", async () => response);
  await assert.rejects(requestJson("https://example.test", {}, options), (error: unknown) => error === abort);
});

test("network and unexpected parser failures never expose raw error messages", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch: internal host"); });
  await assert.rejects(requestJson("https://example.test", {}, options),
    (error: unknown) => error instanceof ClientRequestError && error.message === options.fallbackMessage);
  t.mock.method(globalThis, "fetch", async () => Response.json({}));
  await assert.rejects(requestJson("https://example.test", {}, {
    ...options, parse: () => { throw new Error("private parser diagnostic"); },
  }), (error: unknown) => error instanceof ClientRequestError && error.message === options.fallbackMessage);
});
