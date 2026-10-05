import assert from "node:assert/strict";
import { createServer, type Server, type Socket } from "node:net";
import { type AddressInfo } from "node:net";
import test from "node:test";

import { classifyGraduateEmailDeliveryError } from "@/lib/graduate-email-delivery";
import {
  buildSmtpTransportOptions,
  createSmtpTransport,
  getSmtpConfig,
  SMTP_TIMEOUTS,
  type SmtpConfig,
} from "@/lib/smtp";

const testSmtpPassword = ["smtp", "timeout", "test"].join("-");

function localConfig(port: number): SmtpConfig {
  return {
    host: "127.0.0.1",
    port,
    secure: false,
    user: "sender@example.test",
    pass: testSmtpPassword,
    fromEmail: "sender@example.test",
  };
}

async function startTcpServer(onConnection: (socket: Socket) => void) {
  const sockets = new Set<Socket>();
  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => undefined);
    onConnection(socket);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return {
    port: (server.address() as AddressInfo).port,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const shortTimeouts = Object.freeze({
  dnsTimeoutMs: 500,
  connectionTimeoutMs: 1_000,
  greetingTimeoutMs: 150,
  socketTimeoutMs: 200,
});

test("SMTP transport bounds DNS, connection, greeting, and idle socket waits", () => {
  assert.deepEqual(SMTP_TIMEOUTS, {
    dnsTimeoutMs: 5_000,
    connectionTimeoutMs: 10_000,
    greetingTimeoutMs: 10_000,
    socketTimeoutMs: 20_000,
  });

  const generic = buildSmtpTransportOptions(
    getSmtpConfig({
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "sender@example.test",
      SMTP_PASS: testSmtpPassword,
    }),
  );
  assert.equal(generic.dnsTimeout, 5_000);
  assert.equal(generic.connectionTimeout, 10_000);
  assert.equal(generic.greetingTimeout, 10_000);
  assert.equal(generic.socketTimeout, 20_000);
  assert.equal(generic.host, "smtp.example.test");
  assert.equal(generic.port, 587);
  assert.equal(generic.secure, false);
  assert.equal("tls" in generic, false);

  const legacyWithTls = buildSmtpTransportOptions(
    getSmtpConfig({
      NAVER_SMTP_USER: "legacy@example.test",
      NAVER_SMTP_PASS: testSmtpPassword,
      SMTP_TLS_MIN_DH_SIZE: "512",
    }),
  );
  assert.equal(legacyWithTls.socketTimeout, 20_000);
  assert.deepEqual(legacyWithTls.tls, { minDHSize: 512 });
});

test("a server that never sends the SMTP greeting fails fast with ETIMEDOUT", async () => {
  const server = await startTcpServer(() => {
    // Accept the TCP connection but never write the 220 greeting.
  });
  const transport = createSmtpTransport(localConfig(server.port), shortTimeouts);
  const startedAt = Date.now();
  try {
    await assert.rejects(
      transport.sendMail({
        from: "sender@example.test",
        to: "receiver@example.test",
        subject: "인증 안내",
        text: "테스트",
      }),
      (error: unknown) => {
        assert.equal((error as { code?: unknown }).code, "ETIMEDOUT");
        assert.equal(
          classifyGraduateEmailDeliveryError(error),
          "smtp_connection_failed",
        );
        return true;
      },
    );
    assert.ok(Date.now() - startedAt < 3_000, "greeting timeout must not wait for nodemailer defaults");
  } finally {
    transport.close();
    await server.close();
  }
});

test("a server that stalls after the greeting is cut by the idle socket timeout", async () => {
  const server = await startTcpServer((socket) => {
    socket.write("220 smtp.example.test ESMTP ready\r\n");
    // Read EHLO but never answer it.
    socket.on("data", () => undefined);
  });
  const transport = createSmtpTransport(localConfig(server.port), shortTimeouts);
  const startedAt = Date.now();
  try {
    await assert.rejects(
      transport.sendMail({
        from: "sender@example.test",
        to: "receiver@example.test",
        subject: "인증 안내",
        text: "테스트",
      }),
      (error: unknown) => {
        assert.equal((error as { code?: unknown }).code, "ETIMEDOUT");
        return true;
      },
    );
    assert.ok(Date.now() - startedAt < 3_000, "idle socket timeout must not wait for nodemailer defaults");
  } finally {
    transport.close();
    await server.close();
  }
});

test("DNS and socket timeouts are classified as transient connection failures", () => {
  for (const code of ["ETIMEDOUT", "ETIMEOUT"]) {
    assert.equal(
      classifyGraduateEmailDeliveryError(
        Object.assign(new Error("timeout"), { code }),
      ),
      "smtp_connection_failed",
      code,
    );
  }
});
