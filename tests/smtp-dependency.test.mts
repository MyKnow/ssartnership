import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import nodemailer from "nodemailer";

test("SMTP dependency pins the reviewed TLS cache security release", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  assert.equal(pkg.dependencies.nodemailer, "10.0.12");
  assert.equal(lock.packages["node_modules/nodemailer"].version, "10.0.12");
});

test("updated SMTP transport preserves Korean content without external delivery", async () => {
  const transport = nodemailer.createTransport({ jsonTransport: true });
  try {
    const result = await transport.sendMail({ from: "sender@example.test", to: "receiver@example.test", subject: "인증 안내", text: "테스트 내용", html: "<p>테스트 내용</p>" });
    const message = JSON.parse(result.message);
    assert.equal(message.subject, "인증 안내");
    assert.equal(message.text, "테스트 내용");
    assert.equal(message.html, "<p>테스트 내용</p>");
    assert.equal(message.to[0].address, "receiver@example.test");
  } finally { transport.close(); }
});
