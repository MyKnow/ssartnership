import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { OFFLINE_FALLBACK_PATH, isPwaShellPath } from "@/lib/pwa-shell";

const ORIGIN = "https://ssartnership.test";
const workerSource = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const offlinePage = readFileSync(new URL("../public/offline.html", import.meta.url), "utf8");
const proxySource = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
const nextConfigSource = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");

type Listener = (event: Record<string, unknown>) => void;

type WorkerOptions = {
  fetchImpl?: (request: Request) => Promise<Response>;
  initialCaches?: string[];
};

function createWorker({ fetchImpl, initialCaches = [] }: WorkerOptions = {}) {
  const listeners = new Map<string, Listener>();
  const stores = new Map<string, Map<string, Response>>(
    initialCaches.map((name) => [name, new Map()]),
  );
  const notifications: Array<{ title: string; options: Record<string, unknown> }> = [];
  const fetchCalls: Request[] = [];
  let skipWaitingCalls = 0;
  let claimCalls = 0;

  const caches = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        async put(key: string, response: Response) {
          store.set(key, response);
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
    async match(key: string, options?: { cacheName?: string }) {
      const names = options?.cacheName ? [options.cacheName] : [...stores.keys()];
      for (const name of names) {
        const response = stores.get(name)?.get(key);
        if (response) return response.clone();
      }
      return undefined;
    },
  };

  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener(type: string, listener: Listener) {
      listeners.set(type, listener);
    },
    skipWaiting: async () => {
      skipWaitingCalls += 1;
    },
    clients: {
      claim: async () => {
        claimCalls += 1;
      },
    },
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => {
        notifications.push({ title, options });
      },
    },
  };

  // Browsers resolve relative worker URLs against the worker location.
  class WorkerRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(typeof input === "string" ? new URL(input, self.location) : input, init);
    }
  }

  const context = vm.createContext({
    self,
    caches,
    URL,
    Request: WorkerRequest,
    Response,
    fetch: async (input: Request) => {
      fetchCalls.push(input);
      if (!fetchImpl) throw new TypeError("Failed to fetch");
      return fetchImpl(input);
    },
  });
  vm.runInContext(workerSource, context, { filename: "sw.js" });

  async function dispatchExtendable(type: string, extra: Record<string, unknown> = {}) {
    const pending: Promise<unknown>[] = [];
    listeners.get(type)?.({ ...extra, waitUntil: (promise: Promise<unknown>) => pending.push(promise) });
    await Promise.all(pending);
  }

  // Returns the promise passed to respondWith, or null when the worker let the
  // request through. Not async: awaiting would flatten the responded promise.
  function dispatchFetch(request: Request): Promise<Response> | null {
    let responded: Promise<Response> | null = null;
    listeners.get("fetch")?.({
      request,
      respondWith: (promise: Promise<Response>) => {
        responded = promise;
      },
    });
    return responded;
  }

  return {
    stores,
    notifications,
    fetchCalls,
    counts: () => ({ skipWaitingCalls, claimCalls }),
    install: () => dispatchExtendable("install"),
    activate: () => dispatchExtendable("activate"),
    push: (data: unknown) => dispatchExtendable("push", { data }),
    dispatchFetch,
  };
}

function navigation(path: string, init: { method?: string } = {}) {
  const request = new Request(`${ORIGIN}${path}`, { method: init.method ?? "GET" });
  Object.defineProperty(request, "mode", { value: "navigate" });
  return request;
}

const offlineResponse = () =>
  new Response("<h1>offline</h1>", { status: 200, headers: { "Content-Type": "text/html" } });

test("install precaches the offline page without cookies and still activates on failure", async () => {
  const worker = createWorker({ fetchImpl: async () => offlineResponse() });
  await worker.install();

  assert.equal(worker.fetchCalls.length, 1);
  assert.equal(new URL(worker.fetchCalls[0].url).pathname, OFFLINE_FALLBACK_PATH);
  assert.equal(worker.fetchCalls[0].credentials, "omit");
  assert.equal(worker.fetchCalls[0].cache, "reload");
  assert.deepEqual([...worker.stores.keys()], ["ssartnership-offline-v1"]);
  assert.equal(worker.counts().skipWaitingCalls, 1);

  const offlineInstall = createWorker();
  await offlineInstall.install();
  assert.equal(offlineInstall.stores.size, 0);
  assert.equal(offlineInstall.counts().skipWaitingCalls, 1);
});

test("install refuses to cache a redirected or failed offline response", async () => {
  const redirected = createWorker({
    fetchImpl: async () => {
      const response = offlineResponse();
      Object.defineProperty(response, "redirected", { value: true });
      return response;
    },
  });
  await redirected.install();
  assert.equal(redirected.stores.size, 0);

  const missing = createWorker({ fetchImpl: async () => new Response("", { status: 404 }) });
  await missing.install();
  assert.equal(missing.stores.size, 0);
});

test("activate removes older app caches only and claims clients", async () => {
  const worker = createWorker({
    initialCaches: ["ssartnership-offline-v0", "ssartnership-offline-v1", "other-library-cache"],
  });
  await worker.activate();

  assert.deepEqual([...worker.stores.keys()].sort(), ["other-library-cache", "ssartnership-offline-v1"]);
  assert.equal(worker.counts().claimCalls, 1);
});

test("navigations are network-first and fall back to the offline page", async () => {
  let online = true;
  const worker = createWorker({
    fetchImpl: async (request) => {
      if (new URL(request.url).pathname === OFFLINE_FALLBACK_PATH) return offlineResponse();
      if (!online) throw new TypeError("Failed to fetch");
      return new Response("page", { status: 200 });
    },
  });
  await worker.install();

  const live = worker.dispatchFetch(navigation("/coupons"));
  assert.ok(live);
  assert.equal(await (await live).text(), "page");

  online = false;
  const fallback = worker.dispatchFetch(navigation("/coupons"));
  assert.ok(fallback);
  assert.equal(await (await fallback).text(), "<h1>offline</h1>");
});

test("offline navigation without a cached page surfaces the network error", async () => {
  const worker = createWorker();
  const pending = worker.dispatchFetch(navigation("/"));
  assert.ok(pending);
  await assert.rejects(pending, /Failed to fetch/);
});

test("data, admin, API, and non-GET requests are never intercepted", async () => {
  const worker = createWorker({ fetchImpl: async () => offlineResponse() });

  assert.equal(worker.dispatchFetch(new Request(`${ORIGIN}/api/partners`)), null);
  assert.equal(worker.dispatchFetch(new Request(`${ORIGIN}/_next/static/chunk.js`)), null);
  assert.equal(worker.dispatchFetch(navigation("/admin/members")), null);
  assert.equal(worker.dispatchFetch(navigation("/api/auth/callback")), null);
  assert.equal(worker.dispatchFetch(navigation("/coupons", { method: "POST" })), null);
});

test("push accepts JSON, falls back to text, and never throws on malformed data", async () => {
  const worker = createWorker();
  const jsonData = {
    json: () => ({ title: "공지", body: "내용", url: "/notifications", type: "announcement" }),
    text: () => "",
  };
  const textData = {
    json: () => {
      throw new SyntaxError("Unexpected token");
    },
    text: () => "  일반 텍스트 알림  ",
  };
  const brokenData = {
    json: () => {
      throw new SyntaxError("Unexpected token");
    },
    text: () => {
      throw new Error("unreadable");
    },
  };

  await worker.push(jsonData);
  await worker.push(textData);
  await worker.push(brokenData);
  await worker.push(null);

  assert.deepEqual(
    worker.notifications.map(({ title, options }) => [title, options.body, (options.data as { url: string }).url]),
    [
      ["공지", "내용", "/notifications"],
      ["SSARTNERSHIP", "일반 텍스트 알림", "/"],
      ["SSARTNERSHIP", "새 알림이 도착했습니다.", "/"],
      ["SSARTNERSHIP", "새 알림이 도착했습니다.", "/"],
    ],
  );
});

test("offline page is self-contained and offers a retry", () => {
  assert.match(workerSource, new RegExp(`const OFFLINE_URL = "${OFFLINE_FALLBACK_PATH}"`));
  assert.doesNotMatch(offlinePage, /<link\b|<img\b|\bsrc=|@import|url\(/);
  assert.match(offlinePage, /<html lang="ko">/);
  assert.match(offlinePage, /<button type="button" id="offline-retry">다시 시도<\/button>/);
  assert.match(offlinePage, /window\.addEventListener\("online", retry\)/);
  assert.match(offlinePage, /<meta name="robots" content="noindex" \/>/);
});

test("PWA shell files bypass member gates and the worker script is never cached", () => {
  for (const path of ["/sw.js", "/offline.html", "/manifest.webmanifest"]) {
    assert.equal(isPwaShellPath(path), true, path);
  }
  assert.equal(isPwaShellPath("/offline"), false);
  assert.match(proxySource, /pathname\.startsWith\("\/robots"\) \|\|\s*isPwaShellPath\(pathname\)/);
  assert.match(
    nextConfigSource,
    /source: "\/sw\.js",\s*headers: \[\s*\{\s*key: "Cache-Control",\s*value: "no-cache, no-store, must-revalidate"/,
  );
});
