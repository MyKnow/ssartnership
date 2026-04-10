import assert from "node:assert/strict";
import test from "node:test";

const imageProxyModulePromise = import(
  new URL("../src/lib/image-proxy.ts", import.meta.url).href
);

test("public ip checks block loopback and private ranges", async () => {
  const { isPublicIpAddress } = await imageProxyModulePromise;

  assert.equal(isPublicIpAddress("127.0.0.1"), false);
  assert.equal(isPublicIpAddress("10.0.0.1"), false);
  assert.equal(isPublicIpAddress("100.64.0.1"), false);
  assert.equal(isPublicIpAddress("169.254.1.1"), false);
  assert.equal(isPublicIpAddress("172.16.0.1"), false);
  assert.equal(isPublicIpAddress("192.168.0.1"), false);
  assert.equal(isPublicIpAddress("::1"), false);
  assert.equal(isPublicIpAddress("::ffff:127.0.0.1"), false);
  assert.equal(isPublicIpAddress("::ffff:7f00:1"), false);
  assert.equal(isPublicIpAddress("fc00::1"), false);
  assert.equal(isPublicIpAddress("fe80::1"), false);
  assert.equal(isPublicIpAddress("ff02::1"), false);
});

test("public ip checks allow routable public addresses", async () => {
  const { isPublicIpAddress } = await imageProxyModulePromise;

  assert.equal(isPublicIpAddress("8.8.8.8"), true);
  assert.equal(isPublicIpAddress("1.1.1.1"), true);
  assert.equal(isPublicIpAddress("2001:4860:4860::8888"), true);
});
