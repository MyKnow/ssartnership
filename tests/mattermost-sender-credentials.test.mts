import assert from "node:assert/strict";
import test from "node:test";

type CryptoModule = typeof import("../src/lib/mattermost-senders/crypto.ts");
type AccessModule = typeof import("../src/lib/mattermost-senders/access.ts");
type RoutingModule = typeof import("../src/lib/mattermost-senders/routing.ts");
type ValidationModule = typeof import("../src/lib/mattermost-senders/validation.ts");

const cryptoModulePromise = import(
  new URL("../src/lib/mattermost-senders/crypto.ts", import.meta.url).href,
) as Promise<CryptoModule>;
const accessModulePromise = import(
  new URL("../src/lib/mattermost-senders/access.ts", import.meta.url).href,
) as Promise<AccessModule>;
const routingModulePromise = import(
  new URL("../src/lib/mattermost-senders/routing.ts", import.meta.url).href,
) as Promise<RoutingModule>;
const validationModulePromise = import(
  new URL("../src/lib/mattermost-senders/validation.ts", import.meta.url).href,
) as Promise<ValidationModule>;

const rootKey = Buffer.alloc(32, 7).toString("base64");

test("Sender credential payload는 AES-GCM으로 암호화하고 매번 다른 ciphertext를 만든다", async () => {
  const { decryptMattermostSenderCredentials, encryptMattermostSenderCredentials } =
    await cryptoModulePromise;
  const credentials = {
    loginId: "regional.sender",
    password: "do-not-store-this-plain-text",
  };

  const first = encryptMattermostSenderCredentials(credentials, {
    keyVersion: 1,
    key: rootKey,
  });
  const second = encryptMattermostSenderCredentials(credentials, {
    keyVersion: 1,
    key: rootKey,
  });

  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.doesNotMatch(first.ciphertext, /regional\.sender|do-not-store-this-plain-text/);
  assert.deepEqual(
    decryptMattermostSenderCredentials(first, {
      1: rootKey,
    }),
    credentials,
  );
});

test("Sender credential 암호화는 유효하지 않은 Vercel root key를 거부한다", async () => {
  const { encryptMattermostSenderCredentials } = await cryptoModulePromise;

  assert.throws(
    () => encryptMattermostSenderCredentials(
      { loginId: "sender", password: "password" },
      { keyVersion: 1, key: "not-a-32-byte-key" },
    ),
    /32바이트/,
  );
});

test("Super Admin template과 mattermost_senders 권한이 모두 있어야 Sender 관리가 가능하다", async () => {
  const { canManageMattermostSenders } = await accessModulePromise;

  assert.equal(
    canManageMattermostSenders({
      permissionId: "super_admin",
      permissions: {
        mattermost_senders: { create: true, read: true, update: true, delete: true },
      },
    }, "update"),
    true,
  );
  assert.equal(
    canManageMattermostSenders({
      permissionId: "operations_manager",
      permissions: {
        mattermost_senders: { create: true, read: true, update: true, delete: true },
      },
    }, "update"),
    false,
  );
});

test("Sender 테스트 대상은 인증된 후보 Sender 본인이다", async () => {
  const { resolveMattermostSenderTestRecipient } = await routingModulePromise;

  assert.deepEqual(
    resolveMattermostSenderTestRecipient({
      senderMattermostUserId: "sender-16-id",
    }),
    { kind: "self", userId: "sender-16-id" },
  );
  assert.deepEqual(
    resolveMattermostSenderTestRecipient({
      senderMattermostUserId: "  sender-16-id  ",
    }),
    { kind: "self", userId: "sender-16-id" },
  );
  assert.equal(
    resolveMattermostSenderTestRecipient({
      senderMattermostUserId: "   ",
    }),
    null,
  );
});

test("Mattermost routing template은 운영 입력 없이 기수로 결정된다", async () => {
  const { getMattermostSenderRoutingTemplate } = await routingModulePromise;

  assert.deepEqual(getMattermostSenderRoutingTemplate(16), {
    teamName: "s16public",
    channelName: "town-square",
  });
});

test("Sender 입력값은 기수·login ID·password를 서버 경계에서 모두 검증한다", async () => {
  const { parseMattermostSenderCredentialInput } = await validationModulePromise;

  assert.deepEqual(
    parseMattermostSenderCredentialInput({
      generation: "16",
      loginId: "regional.sender",
      password: " safe password ",
    }),
    {
      ok: true,
      data: {
        generation: 16,
        loginId: "regional.sender",
        password: " safe password ",
      },
    },
  );
  assert.equal(
    parseMattermostSenderCredentialInput({
      generation: "0",
      loginId: "sender",
      password: "password",
    }).ok,
    false,
  );
  assert.equal(
    parseMattermostSenderCredentialInput({
      generation: "16",
      loginId: "sender\u0000",
      password: "password",
    }).ok,
    false,
  );
});
