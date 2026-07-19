import assert from "node:assert/strict";
import test from "node:test";

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
      uploads: [{
        clientId: "profile",
        role: "profile",
        file: new File(["image"], "profile.webp", { type: "image/webp" }),
      }],
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
