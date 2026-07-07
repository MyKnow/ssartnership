import assert from "node:assert/strict";
import test from "node:test";

const redirectModulePromise = import(
  new URL("../src/lib/ssafy-verify/client-redirect.ts", import.meta.url).href,
);

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("SSAFY Verify redirect flow is used for iOS Safari-class browsers", async () => {
  const { shouldUseSsafyVerifyRedirectFlow } = await redirectModulePromise;

  assert.equal(
    shouldUseSsafyVerifyRedirectFlow({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5,
    }),
    true,
  );

  assert.equal(
    shouldUseSsafyVerifyRedirectFlow({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      platform: "MacIntel",
      maxTouchPoints: 0,
    }),
    false,
  );

  assert.equal(
    shouldUseSsafyVerifyRedirectFlow({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      platform: "Win32",
      maxTouchPoints: 0,
    }),
    false,
  );
});

test("SSAFY Verify redirect session parser accepts only current valid sessions", async () => {
  const {
    readSsafyVerifyRedirectSession,
    SSAFY_VERIFY_REDIRECT_SESSION_KEY,
  } = await redirectModulePromise;
  const storage = new MemoryStorage();

  storage.setItem(
    SSAFY_VERIFY_REDIRECT_SESSION_KEY,
    JSON.stringify({
      version: 1,
      purpose: "member-login",
      state: "state-1",
      codeVerifier: "verifier-1",
      redirectUri: "https://ssartnership.myknow.xyz/auth/ssafy",
      returnTo: "/partners/partner-1",
      createdAt: Date.now(),
    }),
  );

  assert.deepEqual(readSsafyVerifyRedirectSession(storage), {
    version: 1,
    purpose: "member-login",
    state: "state-1",
    codeVerifier: "verifier-1",
    redirectUri: "https://ssartnership.myknow.xyz/auth/ssafy",
    returnTo: "/partners/partner-1",
    createdAt: readSsafyVerifyRedirectSession(storage)?.createdAt,
  });

  storage.setItem(
    SSAFY_VERIFY_REDIRECT_SESSION_KEY,
    JSON.stringify({
      version: 1,
      purpose: "member-login",
      state: "state-1",
      codeVerifier: "verifier-1",
      redirectUri: "https://ssartnership.myknow.xyz/auth/ssafy",
      returnTo: null,
      createdAt: Date.now() - 11 * 60 * 1000,
    }),
  );

  assert.equal(readSsafyVerifyRedirectSession(storage), null);

  storage.setItem(SSAFY_VERIFY_REDIRECT_SESSION_KEY, "{not-json");
  assert.equal(readSsafyVerifyRedirectSession(storage), null);
});

