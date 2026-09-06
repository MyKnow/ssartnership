import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import test from "node:test";

import { fetchPublicImage } from "../src/lib/image-proxy/fetch.ts";
import { ImageProxyError } from "../src/lib/image-proxy/shared.ts";
import { resolveInternalPublicSupabaseImageTarget } from "../src/lib/supabase/public-image.ts";
import { createSupabaseTransport } from "../src/lib/supabase/transport.ts";

type CapturedRequest = {
  body: string;
  headers: IncomingMessage["headers"];
  method: string | undefined;
  url: string | undefined;
};

async function captureRequest(request: IncomingMessage): Promise<CapturedRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return {
    body: Buffer.concat(chunks).toString("utf8"),
    headers: request.headers,
    method: request.method,
    url: request.url,
  };
}

async function startServer(
  onRequest: (request: IncomingMessage, response: import("node:http").ServerResponse) => void | Promise<void>,
): Promise<{ close: () => Promise<void>; origin: string }> {
  const server = createServer((request, response) => {
    void onRequest(request, response);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server),
  };
}

async function closeServer(server: Server): Promise<void> {
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("rewrites only the public Supabase origin while preserving request and Next cache data", async () => {
  let publicRequests = 0;
  let internalRequest: CapturedRequest | undefined;
  const publicServer = await startServer((_request, response) => {
    publicRequests += 1;
    response.statusCode = 500;
    response.end("public origin must not receive rewritten calls");
  });
  const internalServer = await startServer(async (request, response) => {
    internalRequest = await captureRequest(request);
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: true }));
  });

  const nativeFetch = globalThis.fetch;
  const calls: Array<{ init: RequestInit | undefined; input: RequestInfo | URL }> = [];
  globalThis.fetch = ((input, init) => {
    calls.push({ input, init });
    return nativeFetch(input, init);
  }) as typeof fetch;

  try {
    const transport = createSupabaseTransport(
      publicServer.origin,
      internalServer.origin,
    );
    const controller = new AbortController();
    const response = await transport(
      `${publicServer.origin}/storage/v1/object/sign/member-images/a.png?download=one%20two&token=a%2Bb&empty=`,
      {
        body: JSON.stringify({ expiresIn: 300 }),
        cache: "no-store",
        headers: {
          authorization: "Bearer local-test-token",
          "content-type": "application/json",
          "x-client-info": "transport-test",
        },
        method: "POST",
        next: { revalidate: 300 },
        signal: controller.signal,
      } as RequestInit,
    );

    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(publicRequests, 0);
    assert.equal(internalRequest?.body, JSON.stringify({ expiresIn: 300 }));
    assert.equal(internalRequest?.method, "POST");
    assert.equal(
      internalRequest?.url,
      "/storage/v1/object/sign/member-images/a.png?download=one%20two&token=a%2Bb&empty=",
    );
    assert.equal(
      internalRequest?.headers.authorization,
      "Bearer local-test-token",
    );
    assert.equal(internalRequest?.headers["content-type"], "application/json");
    assert.equal(internalRequest?.headers["x-client-info"], "transport-test");

    const forwarded = calls.at(-1);
    assert.ok(forwarded?.input instanceof Request);
    assert.equal(forwarded.input.url, `${internalServer.origin}/storage/v1/object/sign/member-images/a.png?download=one%20two&token=a%2Bb&empty=`);
    assert.equal(forwarded.init?.signal, controller.signal);
    assert.deepEqual(
      (forwarded.init as RequestInit & { next?: unknown }).next,
      { revalidate: 300 },
    );
    assert.equal(forwarded.init?.cache, "no-store");
    assert.equal(forwarded.init?.redirect, "error");
  } finally {
    globalThis.fetch = nativeFetch;
    await internalServer.close();
    await publicServer.close();
  }
});

test("does not rewrite arbitrary external requests", async () => {
  let internalRequests = 0;
  let publicRequests = 0;
  let externalRequest: CapturedRequest | undefined;
  const publicServer = await startServer((_request, response) => {
    publicRequests += 1;
    response.statusCode = 500;
    response.end();
  });
  const internalServer = await startServer((_request, response) => {
    internalRequests += 1;
    response.statusCode = 500;
    response.end();
  });
  const externalServer = await startServer(async (request, response) => {
    externalRequest = await captureRequest(request);
    response.end("external response");
  });

  try {
    const transport = createSupabaseTransport(
      publicServer.origin,
      internalServer.origin,
    );
    const response = await transport(`${externalServer.origin}/unexpected?keep=this`, {
      headers: { authorization: "Bearer caller-controlled-test-token" },
      redirect: "manual",
    });

    assert.equal(await response.text(), "external response");
    assert.equal(internalRequests, 0);
    assert.equal(externalRequest?.url, "/unexpected?keep=this");
    assert.equal(
      externalRequest?.headers.authorization,
      "Bearer caller-controlled-test-token",
    );

    const credentialedPublicTarget = new URL(
      "/storage/v1/object/public/member-images/photo.png",
      publicServer.origin,
    );
    credentialedPublicTarget.username = "user";
    credentialedPublicTarget.password = "password";
    await assert.rejects(
      () => transport(credentialedPublicTarget),
      { name: "TypeError" },
    );
    assert.equal(publicRequests, 0);
    assert.equal(internalRequests, 0);
  } finally {
    await externalServer.close();
    await internalServer.close();
    await publicServer.close();
  }
});

test("uses the public Supabase origin unchanged when no internal gateway is configured", async () => {
  let publicRequest: CapturedRequest | undefined;
  const publicServer = await startServer(async (request, response) => {
    publicRequest = await captureRequest(request);
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        signedURL: `${publicServer.origin}/storage/v1/object/sign/member-images/photo.png?token=public-token`,
      }),
    );
  });

  try {
    const transport = createSupabaseTransport(publicServer.origin);
    const response = await transport(
      `${publicServer.origin}/storage/v1/object/sign/member-images/photo.png?expiresIn=300`,
    );

    assert.deepEqual(await response.json(), {
      signedURL: `${publicServer.origin}/storage/v1/object/sign/member-images/photo.png?token=public-token`,
    });
    assert.equal(
      publicRequest?.url,
      "/storage/v1/object/sign/member-images/photo.png?expiresIn=300",
    );
  } finally {
    await publicServer.close();
  }
});

test("blocks redirects from rewritten credential-bearing calls", async () => {
  let redirectedRequests = 0;
  const publicServer = await startServer((_request, response) => {
    response.statusCode = 500;
    response.end();
  });
  const redirectedServer = await startServer((_request, response) => {
    redirectedRequests += 1;
    response.end("must not receive a redirected credential request");
  });
  const internalServer = await startServer((_request, response) => {
    response.statusCode = 302;
    response.setHeader("location", `${redirectedServer.origin}/capture`);
    response.end();
  });

  try {
    const transport = createSupabaseTransport(
      publicServer.origin,
      internalServer.origin,
    );
    await assert.rejects(
      () =>
        transport(`${publicServer.origin}/rest/v1/partners`, {
          headers: { authorization: "Bearer local-test-token" },
        }),
      { name: "TypeError" },
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(redirectedRequests, 0);
  } finally {
    await internalServer.close();
    await redirectedServer.close();
    await publicServer.close();
  }
});

test("an explicitly configured same-origin gateway still blocks redirects", async () => {
  let redirectedRequests = 0;
  const redirectTarget = await startServer((_request, response) => {
    redirectedRequests += 1;
    response.end();
  });
  const publicServer = await startServer((_request, response) => {
    response.statusCode = 302;
    response.setHeader("location", `${redirectTarget.origin}/capture`);
    response.end();
  });

  try {
    const transport = createSupabaseTransport(
      publicServer.origin,
      publicServer.origin,
    );
    await assert.rejects(
      () => transport(`${publicServer.origin}/rest/v1/partners`),
      { name: "TypeError" },
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(redirectedRequests, 0);
  } finally {
    await publicServer.close();
    await redirectTarget.close();
  }
});

test("forwards aborts from the original request after an origin rewrite", async () => {
  let requestStarted: (() => void) | undefined;
  const requestReceived = new Promise<void>((resolve) => {
    requestStarted = resolve;
  });
  const publicServer = await startServer((_request, response) => {
    response.statusCode = 500;
    response.end();
  });
  const internalServer = await startServer((request, response) => {
    requestStarted?.();
    request.once("close", () => response.end());
  });

  try {
    const transport = createSupabaseTransport(
      publicServer.origin,
      internalServer.origin,
    );
    const controller = new AbortController();
    const pending = transport(
      new Request(`${publicServer.origin}/rest/v1/partners`, {
        signal: controller.signal,
      }),
    );

    await requestReceived;
    controller.abort();
    await assert.rejects(pending, /abort/i);
  } finally {
    await internalServer.close();
    await publicServer.close();
  }
});

test("rejects unsafe configuration without returning configured values", () => {
  assert.throws(
    () => createSupabaseTransport("https://user:secret@supabase.test"),
    { message: "Supabase transport configuration is invalid." },
  );
  assert.throws(
    () =>
      createSupabaseTransport(
        "https://public-supabase.test",
        "https://gateway.test/not-an-origin",
      ),
    { message: "Supabase transport configuration is invalid." },
  );
  assert.throws(
    () => createSupabaseTransport("https://public-supabase.test\\gateway"),
    { message: "Supabase transport configuration is invalid." },
  );
  assert.throws(
    () => createSupabaseTransport("https://public-supabase.test\n"),
    { message: "Supabase transport configuration is invalid." },
  );
});

test("routes only configured public Storage objects through the private image gateway", async () => {
  let publicRequests = 0;
  let internalRequest: CapturedRequest | undefined;
  const publicServer = await startServer((_request, response) => {
    publicRequests += 1;
    response.statusCode = 500;
    response.end();
  });
  const internalServer = await startServer(async (request, response) => {
    internalRequest = await captureRequest(request);
    response.setHeader("content-type", "image/png");
    response.end("png");
  });
  const originalPublicUrl = process.env.SUPABASE_URL;
  const originalInternalUrl = process.env.SUPABASE_INTERNAL_URL;

  try {
    process.env.SUPABASE_URL = publicServer.origin;
    process.env.SUPABASE_INTERNAL_URL = internalServer.origin;
    const result = await fetchPublicImage(
      new URL(
        "/storage/v1/object/public/member-images/folder/photo.png",
        publicServer.origin,
      ),
    );

    assert.equal(publicRequests, 0);
    assert.deepEqual(result.body, Buffer.from("png"));
    assert.equal(result.contentType, "image/png");
    assert.equal(
      internalRequest?.url,
      "/storage/v1/object/public/member-images/folder/photo.png",
    );
    assert.equal(internalRequest?.method, "GET");
    assert.equal(internalRequest?.headers.authorization, undefined);
    assert.equal(internalRequest?.headers.apikey, undefined);
  } finally {
    if (originalPublicUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalPublicUrl;
    }
    if (originalInternalUrl === undefined) {
      delete process.env.SUPABASE_INTERNAL_URL;
    } else {
      process.env.SUPABASE_INTERNAL_URL = originalInternalUrl;
    }
    await internalServer.close();
    await publicServer.close();
  }
});

test("does not map encoded traversal, private, signed, double-encoded, or queried Storage URLs", () => {
  const config = {
    publicSupabaseUrl: "http://127.0.0.1:58000",
    internalSupabaseUrl: "http://gateway:8000",
  };
  const resolve = (path: string) =>
    resolveInternalPublicSupabaseImageTarget(
      new URL(path, config.publicSupabaseUrl),
      config,
    );

  assert.equal(
    resolve("/storage/v1/object/public/member-images/folder/photo.png")?.href,
    "http://gateway:8000/storage/v1/object/public/member-images/folder/photo.png",
  );
  for (const path of [
    "/storage/v1/object/public/member-images/%2e%2e/private.png",
    "/storage/v1/object/public/member-images/%2Fprivate.png",
    "/storage/v1/object/public/member-images/%5Cprivate.png",
    "/storage/v1/object/public/member-images/%252Fprivate.png",
    "/storage/v1/object/public/member-images/%252e%252e/private.png",
    "/storage/v1/object/public/member-images/folder/%2e%2e",
    "/storage/v1/object/sign/member-images/private.png?token=signed",
    "/storage/v1/object/authenticated/member-images/private.png",
    "/storage/v1/object/public/member-images/photo.png?download=1",
    "/storage/v1/object/public/member-images/photo.png#fragment",
  ]) {
    assert.equal(resolve(path), null, path);
  }

  assert.equal(
    resolveInternalPublicSupabaseImageTarget(
      new URL("http://user:password@127.0.0.1:58000/storage/v1/object/public/member-images/photo.png"),
      config,
    ),
    null,
  );
});

test("keeps image gateway redirects rejected", async () => {
  let redirectedRequests = 0;
  const publicServer = await startServer((_request, response) => {
    response.statusCode = 500;
    response.end();
  });
  const redirectedServer = await startServer((_request, response) => {
    redirectedRequests += 1;
    response.end("must not receive an image request");
  });
  const internalServer = await startServer((_request, response) => {
    response.statusCode = 302;
    response.setHeader("location", `${redirectedServer.origin}/capture`);
    response.end();
  });
  const originalPublicUrl = process.env.SUPABASE_URL;
  const originalInternalUrl = process.env.SUPABASE_INTERNAL_URL;

  try {
    process.env.SUPABASE_URL = publicServer.origin;
    process.env.SUPABASE_INTERNAL_URL = internalServer.origin;
    await assert.rejects(
      () =>
        fetchPublicImage(
          new URL(
            "/storage/v1/object/public/member-images/photo.png",
            publicServer.origin,
          ),
        ),
      (error: unknown) =>
        error instanceof ImageProxyError && error.status === 502,
    );
    assert.equal(redirectedRequests, 0);
  } finally {
    if (originalPublicUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = originalPublicUrl;
    }
    if (originalInternalUrl === undefined) {
      delete process.env.SUPABASE_INTERNAL_URL;
    } else {
      process.env.SUPABASE_INTERNAL_URL = originalInternalUrl;
    }
    await internalServer.close();
    await redirectedServer.close();
    await publicServer.close();
  }
});
