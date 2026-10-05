import dns from "node:dns/promises";
import http from "node:http";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { fetchPublicImage } from "../../src/lib/image-proxy/fetch";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function fakeRequest(response?: PassThrough & { statusCode: number; headers: http.IncomingHttpHeaders }) {
  const request = new EventEmitter() as EventEmitter & { end: () => void; destroy: (error?: Error) => void };
  request.destroy = vi.fn((error?: Error) => {
    if (error) request.emit("error", error);
    response?.destroy(error);
  });
  const spy = vi.spyOn(http, "request").mockImplementation(((_options: http.RequestOptions, callback: (response: http.IncomingMessage) => void) => {
    _options.signal?.addEventListener("abort", () => request.destroy(_options.signal?.reason), { once: true });
    request.end = () => { if (response) callback(response as unknown as http.IncomingMessage); };
    return request as unknown as http.ClientRequest;
  }) as typeof http.request);
  return { request, spy };
}

function fakeResponse(statusCode: number, headers: http.IncomingHttpHeaders) {
  return Object.assign(new PassThrough(), { statusCode, headers });
}

test("DNS 대기도 이미지 fetch 전체 제한 시간 안에 끝난다", async () => {
  vi.spyOn(dns, "lookup").mockImplementation(() => new Promise(() => {}));
  const { spy } = fakeRequest();
  let settled = false;
  const outcome = fetchPublicImage(new URL("http://image.example.test/a"), { timeoutMs: 100 }).then(
    () => { settled = true; return null; },
    (error: unknown) => { settled = true; return error; },
  );
  await vi.advanceTimersByTimeAsync(101);
  expect(settled).toBe(true);
  expect(await outcome).toMatchObject({ status: 502 });
  expect(spy).not.toHaveBeenCalled();
});

test("DNS에 쓴 시간을 빼고 같은 마감 시간에 HTTP 요청을 끊는다", async () => {
  vi.spyOn(dns, "lookup").mockImplementation(() => new Promise((resolve) => {
    setTimeout(() => resolve([{ address: "8.8.8.8", family: 4 }] as never), 70);
  }));
  const { request, spy } = fakeRequest();
  let settled = false;
  const outcome = fetchPublicImage(new URL("http://image.example.test/a"), { timeoutMs: 100 }).catch((error: unknown) => {
    settled = true;
    return error;
  });
  await vi.advanceTimersByTimeAsync(80);
  expect(spy).toHaveBeenCalledOnce();
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(21);
  expect(settled).toBe(true);
  expect(await outcome).toMatchObject({ status: 502 });
  expect(request.destroy).toHaveBeenCalledOnce();
});

test.each([
  { label: "오류 상태", status: 404, headers: { "content-type": "image/png" }, expected: 502 },
  { label: "이미지가 아닌 응답", status: 200, headers: { "content-type": "text/plain" }, expected: 415 },
  { label: "한도보다 큰 선언 길이", status: 200, headers: { "content-type": "image/png", "content-length": "1000" }, expected: 413 },
])("$label는 응답을 거부할 때 원격 스트림도 닫는다", async ({ status, headers, expected }) => {
  const response = fakeResponse(status, headers);
  fakeRequest(response);
  try {
    await expect(fetchPublicImage(new URL("http://8.8.8.8/a"), { maxBytes: 32 })).rejects.toMatchObject({ status: expected });
    expect(response.destroyed).toBe(true);
  } finally {
    response.destroy();
  }
});

test("길이 없는 이미지 스트림도 실제 바이트가 한도를 넘으면 닫는다", async () => {
  const response = fakeResponse(200, { "content-type": "image/png" });
  fakeRequest(response);
  const outcome = fetchPublicImage(new URL("http://8.8.8.8/a"), { maxBytes: 32 });
  const assertion = expect(outcome).rejects.toMatchObject({ status: 413 });
  await vi.advanceTimersByTimeAsync(0);
  response.end(Buffer.alloc(33));
  await assertion;
  expect(response.destroyed).toBe(true);
});

test("허용된 이미지 응답은 제한 안에서 본문을 돌려준다", async () => {
  const response = fakeResponse(200, { "content-type": "image/png" });
  fakeRequest(response);
  const outcome = fetchPublicImage(new URL("http://8.8.8.8/a"), { maxBytes: 32 });
  await vi.advanceTimersByTimeAsync(0);
  response.end(Buffer.from("image-body"));
  await expect(outcome).resolves.toEqual({ body: Buffer.from("image-body"), contentType: "image/png" });
  expect(vi.getTimerCount()).toBe(0);
});

test("응답 헤더를 받은 뒤 멈춘 본문도 같은 마감 시간에 닫힌다", async () => {
  const response = fakeResponse(200, { "content-type": "image/png" });
  const { request } = fakeRequest(response);
  const outcome = fetchPublicImage(new URL("http://8.8.8.8/a"), { timeoutMs: 100 });
  const assertion = expect(outcome).rejects.toMatchObject({ status: 502 });
  await vi.advanceTimersByTimeAsync(80);
  response.write(Buffer.from("partial"));
  await vi.advanceTimersByTimeAsync(21);
  await assertion;
  expect(request.destroy).toHaveBeenCalledOnce();
  expect(response.destroyed).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

test("마감 뒤 DNS가 실패해도 HTTP 요청이나 처리되지 않은 거부가 생기지 않는다", async () => {
  let rejectLookup!: (error: Error) => void;
  vi.spyOn(dns, "lookup").mockImplementation(() => new Promise((_resolve, reject) => { rejectLookup = reject; }));
  const { spy } = fakeRequest();
  const outcome = fetchPublicImage(new URL("http://image.example.test/a"), { timeoutMs: 100 });
  const assertion = expect(outcome).rejects.toMatchObject({ status: 502 });
  await vi.advanceTimersByTimeAsync(101);
  await assertion;
  rejectLookup(new Error("late DNS failure"));
  await vi.advanceTimersByTimeAsync(0);
  expect(spy).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
