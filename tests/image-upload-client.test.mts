import assert from "node:assert/strict";
import test from "node:test";

function createProfileUpload() {
  return {
    clientId: "profile",
    role: "profile",
    file: new File(["image"], "profile.webp", { type: "image/webp" }),
  };
}

test("공통 업로드 클라이언트는 처리 중 응답을 같은 uploadId로 재시도한다", async () => {
  const { uploadImagesToStaging } = await import("../src/lib/image-upload/client.ts");
  const uploadId = "03f5459b-dfee-4558-907a-509a396312f5";
  const requests: Array<{ url: string; body?: unknown }> = [];
  const originalFetch = globalThis.fetch;
  let completeAttempts = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    requests.push({ url, body });
    if (url === "/api/uploads/images/sign") {
      return new Response(JSON.stringify({
        ok: true,
        uploads: [{ id: uploadId, clientId: "profile", signedUrl: "https://storage.example/upload" }],
        uploadHeaders: { apikey: "public" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://storage.example/upload") {
      return new Response(null, { status: 200 });
    }
    if (url === "/api/uploads/images/complete") {
      completeAttempts += 1;
      if (completeAttempts === 1) {
        return new Response(JSON.stringify({
          ok: false,
          code: "upload_processing",
          message: "이미지를 처리 중입니다.",
        }), { status: 409, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({
        ok: true,
        uploads: [{ id: uploadId }],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  try {
    const results = await uploadImagesToStaging({
      purpose: "profile",
      actorMode: "member",
      uploads: [createProfileUpload()],
    });

    assert.deepEqual(results, [{ clientId: "profile", uploadId }]);
    const completionBodies = requests
      .filter((request) => request.url === "/api/uploads/images/complete")
      .map((request) => request.body);
    assert.deepEqual(completionBodies, [
      { purpose: "profile", actorMode: "member", uploadIds: [uploadId] },
      { purpose: "profile", actorMode: "member", uploadIds: [uploadId] },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("공통 업로드 클라이언트는 서명 요청의 브라우저 오류를 노출하지 않는다", async () => {
  const { uploadImagesToStaging } = await import("../src/lib/image-upload/client.ts");
  const { ClientSafeRequestError } = await import(
    "../src/lib/client-safe-request-error.ts"
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };

  try {
    await assert.rejects(
      uploadImagesToStaging({
        purpose: "profile",
        actorMode: "member",
        uploads: [createProfileUpload()],
      }),
      (error: unknown) => {
        assert.ok(error instanceof ClientSafeRequestError);
        assert.equal(error.code, "network_unavailable");
        assert.equal(
          error.message,
          "이미지 업로드 URL을 발급하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
        );
        assert.doesNotMatch(error.message, /Failed to fetch/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("공통 업로드 클라이언트는 서명 요청의 알 수 없는 오류도 노출하지 않는다", async () => {
  const { uploadImagesToStaging } = await import("../src/lib/image-upload/client.ts");
  const { ClientSafeRequestError } = await import(
    "../src/lib/client-safe-request-error.ts"
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("storage-internal-token=should-not-leak");
  };

  try {
    await assert.rejects(
      uploadImagesToStaging({
        purpose: "profile",
        actorMode: "member",
        uploads: [createProfileUpload()],
      }),
      (error: unknown) => {
        assert.ok(error instanceof ClientSafeRequestError);
        assert.equal(error.code, "request_failed");
        assert.equal(error.message, "이미지 업로드 URL을 발급하지 못했습니다.");
        assert.doesNotMatch(error.message, /storage-internal-token/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("공통 업로드 클라이언트는 완료 요청의 브라우저 오류를 재시도 후 안전하게 반환한다", async () => {
  const { uploadImagesToStaging } = await import("../src/lib/image-upload/client.ts");
  const { ClientSafeRequestError } = await import(
    "../src/lib/client-safe-request-error.ts"
  );
  const uploadId = "b5d787ff-ef0f-43bc-b3d5-f7ba9865c957";
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  let completeAttempts = 0;
  globalThis.setTimeout = ((callback: TimerHandler) => {
    if (typeof callback === "function") {
      callback();
    }
    return 0;
  }) as typeof globalThis.setTimeout;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "/api/uploads/images/sign") {
      return new Response(JSON.stringify({
        ok: true,
        uploads: [{
          id: uploadId,
          clientId: "profile",
          signedUrl: "https://storage.example/upload",
        }],
        uploadHeaders: { apikey: "public" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://storage.example/upload") {
      return new Response(null, { status: 200 });
    }
    if (url === "/api/uploads/images/complete") {
      completeAttempts += 1;
      throw new TypeError("Failed to fetch");
    }
    throw new Error(`unexpected request: ${url}`);
  };

  try {
    await assert.rejects(
      uploadImagesToStaging({
        purpose: "profile",
        actorMode: "member",
        uploads: [createProfileUpload()],
      }),
      (error: unknown) => {
        assert.ok(error instanceof ClientSafeRequestError);
        assert.equal(error.code, "network_unavailable");
        assert.equal(
          error.message,
          "이미지 처리 요청에 실패했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
        );
        assert.doesNotMatch(error.message, /Failed to fetch/);
        return true;
      },
    );
    assert.equal(completeAttempts, 3);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});
