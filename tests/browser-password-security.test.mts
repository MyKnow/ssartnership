import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const browserPasswordModuleUrl = new URL(
  "../src/lib/browser-password.ts",
  import.meta.url,
);
const browserPasswordSourceUrl = new URL(
  "../src/lib/browser-password.ts",
  import.meta.url,
);

type CryptoOverride = {
  getRandomValues: <T extends ArrayBufferView | null>(array: T) => T;
};

async function withBrowserCrypto<T>(
  cryptoOverride: CryptoOverride | undefined,
  callback: () => Promise<T> | T,
) {
  const originalCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: cryptoOverride,
  });

  try {
    return await callback();
  } finally {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  }
}

test("browser password generation rejects unsupported lengths before reading crypto", async () => {
  const { tryGenerateBrowserPassword } = await import(browserPasswordModuleUrl.href);
  let cryptoCalls = 0;

  await withBrowserCrypto(
    {
      getRandomValues(array) {
        cryptoCalls += 1;
        return array;
      },
    },
    () => {
      for (const length of [7, 65, 8.5, Number.NaN]) {
        const result = tryGenerateBrowserPassword(length);
        assert.deepEqual(result, {
          ok: false,
          error: {
            code: "invalid_length",
            message: "비밀번호 자동 생성 길이는 8자 이상 64자 이하의 정수여야 합니다.",
          },
        });
      }
    },
  );

  assert.equal(cryptoCalls, 0);
});

test("browser password generation fails closed without Web Crypto and never falls back to Math.random", async () => {
  const {
    BROWSER_PASSWORD_GENERATION_UNAVAILABLE_MESSAGE,
    generateBrowserPassword,
    tryGenerateBrowserPassword,
  } = await import(browserPasswordModuleUrl.href);
  const originalRandom = Math.random;
  let mathRandomCalls = 0;
  Math.random = () => {
    mathRandomCalls += 1;
    throw new Error("Math.random must not be used");
  };

  try {
    await withBrowserCrypto(undefined, () => {
      const result = tryGenerateBrowserPassword(12);
      assert.deepEqual(result, {
        ok: false,
        error: {
          code: "secure_random_unavailable",
          message: BROWSER_PASSWORD_GENERATION_UNAVAILABLE_MESSAGE,
        },
      });
      assert.throws(
        () => generateBrowserPassword(12),
        (error: unknown) =>
          error instanceof Error &&
          error.message === BROWSER_PASSWORD_GENERATION_UNAVAILABLE_MESSAGE,
      );
    });
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(mathRandomCalls, 0);
  const source = await readFile(browserPasswordSourceUrl, "utf8");
  assert.doesNotMatch(source, /Math\.random/);
});

test("browser password generation uses rejection sampling and preserves the mocked-crypto story path", async () => {
  const {
    generateBrowserPassword,
    isBrowserPasswordValid,
    tryGenerateBrowserPassword,
  } = await import(browserPasswordModuleUrl.href);
  let cryptoCalls = 0;

  await withBrowserCrypto(
    {
      getRandomValues(array) {
        assert.ok(array instanceof Uint32Array);
        array[0] = cryptoCalls === 0 ? 0xffff_ffff : 7;
        cryptoCalls += 1;
        return array;
      },
    },
    () => {
      const result = tryGenerateBrowserPassword(12);
      assert.equal(result.ok, true);
      if (!result.ok) {
        return;
      }
      assert.equal(result.password.length, 12);
      assert.equal(isBrowserPasswordValid(result.password), true);
      assert.equal(cryptoCalls, 24);

      const storyCompatiblePassword = generateBrowserPassword(10);
      assert.equal(storyCompatiblePassword.length, 10);
      assert.equal(isBrowserPasswordValid(storyCompatiblePassword), true);
    },
  );
});

test("browser password generation maps crypto failures and bounded rejection exhaustion to a typed unavailable result", async () => {
  const {
    BROWSER_PASSWORD_GENERATION_UNAVAILABLE_MESSAGE,
    tryGenerateBrowserPassword,
  } = await import(browserPasswordModuleUrl.href);

  await withBrowserCrypto(
    {
      getRandomValues() {
        throw new Error("blocked by browser policy");
      },
    },
    () => {
      assert.deepEqual(tryGenerateBrowserPassword(12), {
        ok: false,
        error: {
          code: "secure_random_unavailable",
          message: BROWSER_PASSWORD_GENERATION_UNAVAILABLE_MESSAGE,
        },
      });
    },
  );

  let rejectionCalls = 0;
  await withBrowserCrypto(
    {
      getRandomValues(array) {
        assert.ok(array instanceof Uint32Array);
        array[0] = 0xffff_ffff;
        rejectionCalls += 1;
        return array;
      },
    },
    () => {
      const result = tryGenerateBrowserPassword(12);
      assert.equal(result.ok, false);
      if (result.ok) {
        return;
      }
      assert.equal(result.error.code, "secure_random_unavailable");
      assert.equal(
        result.error.message,
        BROWSER_PASSWORD_GENERATION_UNAVAILABLE_MESSAGE,
      );
    },
  );
  assert.equal(rejectionCalls, 128);
});

const formContracts = [
  {
    path: "../src/components/auth/ResetPasswordCompleteForm.tsx",
    passwordSetter: "setPassword(passwordResult.password)",
    passwordRef: "passwordRef",
  },
  {
    path: "../src/components/partner/PartnerPasswordChangeForm.tsx",
    passwordSetter: "setNextPassword(passwordResult.password)",
    passwordRef: "nextPasswordRef",
  },
  {
    path: "../src/components/partner/PartnerSetupForm.tsx",
    passwordSetter: "setPassword(passwordResult.password)",
    passwordRef: "passwordRef",
  },
] as const;

test("password forms fail closed, surface the shared error, and focus without mutating password state", async () => {
  for (const contract of formContracts) {
    const source = await readFile(new URL(contract.path, import.meta.url), "utf8");
    const handlerStart = source.indexOf("const handleGeneratePassword");
    const handlerEnd = source.indexOf("\n  const handleSubmit", handlerStart);
    assert.ok(handlerStart >= 0, `${contract.path}: generation handler is missing`);
    assert.ok(handlerEnd > handlerStart, `${contract.path}: generation handler is incomplete`);

    const handler = source.slice(handlerStart, handlerEnd);
    const resultIndex = handler.indexOf("tryGenerateBrowserPassword(12)");
    const failureGuardIndex = handler.indexOf("if (!passwordResult.ok)");
    const sharedErrorIndex = handler.indexOf("passwordResult.error.message");
    const focusIndex = handler.indexOf(`focusField(${contract.passwordRef})`);
    const failureReturnIndex = handler.indexOf("return;", failureGuardIndex);
    const passwordMutationIndex = handler.indexOf(contract.passwordSetter);

    assert.ok(resultIndex >= 0, `${contract.path}: typed generation result is missing`);
    assert.ok(
      failureGuardIndex > resultIndex,
      `${contract.path}: generation failure is not checked`,
    );
    assert.ok(
      sharedErrorIndex > failureGuardIndex,
      `${contract.path}: shared generation error is not displayed`,
    );
    assert.ok(
      focusIndex > failureGuardIndex,
      `${contract.path}: password field is not focused on failure`,
    );
    assert.ok(
      failureReturnIndex > focusIndex,
      `${contract.path}: failure path does not return after focus`,
    );
    assert.ok(
      passwordMutationIndex > failureReturnIndex,
      `${contract.path}: password state can change before failure returns`,
    );
  }
});
