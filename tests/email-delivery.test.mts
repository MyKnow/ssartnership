import assert from "node:assert/strict";
import test from "node:test";

const emailDeliveryModulePromise = import(
  new URL("../src/lib/email-delivery.ts", import.meta.url).href
);

const testResendApiKey = ["re", "test", "key"].join("_");
const testRedactedApiKey = ["re", "private", "value"].join("_");
const testSmtpPassword = ["smtp", "test", "password"].join("-");

const resendEnv = {
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: testResendApiKey,
  EMAIL_FROM: "싸트너십 <auth@ssartnership.myknow.xyz>",
  EMAIL_REPLY_TO: "myknow@ssafy.com",
};

test("Resend 설정은 명시적인 공급자 선택과 고정 발신자 계약을 요구한다", async () => {
  const { getEmailDeliveryConfig } = await emailDeliveryModulePromise;

  assert.deepEqual(getEmailDeliveryConfig(resendEnv), {
    provider: "resend",
    apiKey: testResendApiKey,
    from: "싸트너십 <auth@ssartnership.myknow.xyz>",
    replyTo: "myknow@ssafy.com",
  });
  assert.throws(
    () => getEmailDeliveryConfig({ EMAIL_PROVIDER: "resend" }),
    (error: unknown) => {
      assert.equal(
        (error as { code?: string }).code,
        "resend_missing_env",
      );
      assert.deepEqual(
        (error as { missingEnv?: readonly string[] }).missingEnv,
        ["RESEND_API_KEY", "EMAIL_FROM", "EMAIL_REPLY_TO"],
      );
      return true;
    },
  );
  assert.throws(
    () => getEmailDeliveryConfig({ EMAIL_PROVIDER: "automatic" }),
    (error: unknown) => {
      assert.equal(
        (error as { code?: string }).code,
        "email_provider_invalid",
      );
      return true;
    },
  );
});

test("설정 진단은 API 키나 잘못 입력한 주소를 로그에 포함하지 않는다", async () => {
  const {
    getEmailDeliveryConfig,
    toEmailDeliveryConfigErrorLog,
  } = await emailDeliveryModulePromise;
  let captured: unknown;
  try {
    getEmailDeliveryConfig({
      ...resendEnv,
      RESEND_API_KEY: testRedactedApiKey,
      EMAIL_FROM: "invalid-address user@example.com",
    });
  } catch (error) {
    captured = error;
  }

  const serialized = JSON.stringify(toEmailDeliveryConfigErrorLog(captured));
  assert.match(serialized, /resend_invalid_env|EMAIL_FROM/);
  assert.doesNotMatch(serialized, new RegExp(`${testRedactedApiKey}|user@example\\.com`));
});

test("Resend 요청은 Reply-To, Bcc, 본문과 중복 방지 키를 공식 API 형식으로 전송한다", async () => {
  const { sendTransactionalEmail } = await emailDeliveryModulePromise;
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({ id: "email-id" }), { status: 200 });
  }) as typeof fetch;

  await sendTransactionalEmail(
    {
      to: "graduate@example.com",
      bcc: "operator@example.com",
      subject: "인증 코드",
      text: "123456",
      html: "<strong>123456</strong>",
      idempotencyKey: "graduate-email:request-id",
    },
    { env: resendEnv, fetchImpl },
  );

  assert.equal(capturedUrl, "https://api.resend.com/emails");
  assert.equal(capturedInit?.method, "POST");
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("authorization"), `Bearer ${testResendApiKey}`);
  assert.equal(
    headers.get("idempotency-key"),
    "graduate-email:request-id",
  );
  assert.match(headers.get("user-agent") ?? "", /ssartnership-email/);
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    from: "싸트너십 <auth@ssartnership.myknow.xyz>",
    to: ["graduate@example.com"],
    bcc: ["operator@example.com"],
    reply_to: "myknow@ssafy.com",
    subject: "인증 코드",
    text: "123456",
    html: "<strong>123456</strong>",
  });
});

test("호출부의 Reply-To는 문의 회신처럼 명시적인 업무 흐름에서 기본값을 덮어쓴다", async () => {
  const { sendTransactionalEmail } = await emailDeliveryModulePromise;
  let body: Record<string, unknown> | undefined;
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    body = JSON.parse(String(init?.body));
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  await sendTransactionalEmail(
    {
      to: "partner@example.com",
      replyTo: "partner@example.com",
      subject: "제휴 문의",
      text: "문의 내용",
    },
    { env: resendEnv, fetchImpl },
  );

  assert.equal(body?.reply_to, "partner@example.com");
});

test("Resend 오류는 raw 응답 없이 허용된 운영 코드로 정규화된다", async () => {
  const {
    EmailProviderError,
    sendTransactionalEmail,
  } = await emailDeliveryModulePromise;
  const fetchImpl = (async () => new Response(
    JSON.stringify({
      name: "validation_error",
      message: `${testRedactedApiKey} graduate@example.com rejected`,
    }),
    { status: 422 },
  )) as typeof fetch;

  await assert.rejects(
    sendTransactionalEmail(
      {
        to: "graduate@example.com",
        subject: "인증 코드",
        text: "123456",
      },
      { env: resendEnv, fetchImpl },
    ),
    (error: unknown) => {
      assert.ok(error instanceof EmailProviderError);
      const providerError = error as InstanceType<typeof EmailProviderError>;
      assert.equal(providerError.code, "resend_recipient_rejected");
      assert.equal(providerError.status, 422);
      assert.doesNotMatch(
        JSON.stringify(error),
        new RegExp(`${testRedactedApiKey}|graduate@example\\.com|validation_error`),
      );
      return true;
    },
  );
});

test("EMAIL_PROVIDER 미지정 시 기존 SMTP가 명시적인 롤백 경로로 남는다", async () => {
  const { getEmailDeliveryConfig } = await emailDeliveryModulePromise;
  const config = getEmailDeliveryConfig({
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "587",
    SMTP_SECURE: "false",
    SMTP_USER: "sender@example.com",
    SMTP_PASS: testSmtpPassword,
  });

  assert.equal(config.provider, "smtp");
  if (config.provider === "smtp") {
    assert.equal(config.smtp.host, "smtp.example.com");
    assert.equal(config.smtp.secure, false);
    assert.equal(config.from, "싸트너십 <sender@example.com>");
  }
});
