import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  JsonRequestBodyError,
  MAX_STANDARD_JSON_BODY_BYTES,
  readJsonRequestBodyWithinLimit,
} from "../src/lib/request-body-limit.ts";

const root = new URL("..", import.meta.url);

type RouteContract = {
  path: string;
  beforeParser: string[];
  afterParser: string[];
  invalidMessage: string;
};

const ROUTE_CONTRACTS: RouteContract[] = [
  {
    path: "src/app/api/certification/photo/route.ts",
    beforeParser: [
      "isTrustedSameOriginRequest",
      "getSignedUserSession()",
      "isGraduateVerificationBlocked(rateLimitContext)",
    ],
    afterParser: [],
    invalidMessage: "사진 업로드를 확인해 주세요.",
  },
  {
    path: "src/app/api/graduate-verification/account/setup/route.ts",
    beforeParser: ["isTrustedSameOriginRequest"],
    afterParser: ["isGraduateVerificationBlocked(rateLimitContext)"],
    invalidMessage:
      "비밀번호는 8~64자이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.",
  },
  {
    path: "src/app/api/graduate-verification/email/send/route.ts",
    beforeParser: ["isTrustedSameOriginRequest"],
    afterParser: ["getGraduateEmailSendBlockingState(rateLimitContext)"],
    invalidMessage: "이메일 주소를 확인해 주세요.",
  },
  {
    path: "src/app/api/graduate-verification/email/verify/route.ts",
    beforeParser: ["isTrustedSameOriginRequest"],
    afterParser: ["isGraduateVerificationBlocked(rateLimitContext)"],
    invalidMessage: "이메일과 6자리 인증 코드를 확인해 주세요.",
  },
  {
    path: "src/app/api/graduate-verification/password-reset/send/route.ts",
    beforeParser: ["isTrustedSameOriginRequest"],
    afterParser: ["isGraduateVerificationBlocked(rateLimitContext)"],
    invalidMessage: "이메일 주소를 확인해 주세요.",
  },
  {
    path: "src/app/api/graduate-verification/password-reset/verify/route.ts",
    beforeParser: ["isTrustedSameOriginRequest"],
    afterParser: ["isGraduateVerificationBlocked(rateLimitContext)"],
    invalidMessage: "이메일과 6자리 인증 코드를 확인해 주세요.",
  },
  {
    path: "src/app/api/graduate-verification/submit/route.ts",
    beforeParser: [
      "isTrustedSameOriginRequest",
      "getGraduateApplicationSession()",
      "getVerifiedGraduateApplicationChallenge(session.challengeId)",
      "isGraduateVerificationBlocked(rateLimitContext)",
    ],
    afterParser: [],
    invalidMessage: "업로드 파일을 확인해 주세요.",
  },
  {
    path: "src/app/api/member-password-action/complete/route.ts",
    beforeParser: ["isTrustedSameOriginRequest"],
    afterParser: ['getMemberAuthBlockingState("manual-password-action", throttle)'],
    invalidMessage:
      "비밀번호는 8~64자이며 영문, 숫자, 특수문자를 모두 포함해야 합니다.",
  },
  {
    path: "src/app/api/member-password-action/reset/route.ts",
    beforeParser: ["isTrustedSameOriginRequest"],
    afterParser: ['getMemberAuthBlockingState("reset-password", throttle)'],
    invalidMessage: "이메일 주소를 확인해 주세요.",
  },
  {
    path: "src/app/api/member/email/send/route.ts",
    beforeParser: ["isTrustedSameOriginRequest", "getSignedUserSession()"],
    afterParser: [
      'getMemberEmailVerificationBlockingState("send", rateLimitContext)',
    ],
    invalidMessage: "이메일 주소를 확인해 주세요.",
  },
  {
    path: "src/app/api/member/email/verify/route.ts",
    beforeParser: ["isTrustedSameOriginRequest", "getSignedUserSession()"],
    afterParser: [
      'getMemberEmailVerificationBlockingState("verify", rateLimitContext)',
    ],
    invalidMessage: "이메일과 6자리 인증 코드를 확인해 주세요.",
  },
  {
    path: "src/app/api/member/recovery/email/send/route.ts",
    beforeParser: [
      "isTrustedSameOriginRequest",
      "getMemberEmailRecoverySession()",
    ],
    afterParser: [
      'getMemberEmailVerificationBlockingState("recovery-send", rateLimitContext)',
    ],
    invalidMessage: "이메일 주소를 확인해 주세요.",
  },
  {
    path: "src/app/api/member/recovery/email/verify/route.ts",
    beforeParser: [
      "isTrustedSameOriginRequest",
      "getMemberEmailRecoverySession()",
    ],
    afterParser: [
      'getMemberEmailVerificationBlockingState("recovery-verify", rateLimitContext)',
    ],
    invalidMessage: "이메일과 6자리 인증 코드를 확인해 주세요.",
  },
  {
    path: "src/app/api/member/recovery/start/route.ts",
    beforeParser: ["isTrustedSameOriginRequest"],
    afterParser: [
      'getMemberAuthBlockingState("member-email-recovery", throttle)',
    ],
    invalidMessage: "GENERIC_ERROR",
  },
];

async function readSource(path: string) {
  return readFile(new URL(path, root), "utf8");
}

function createStreamedRequest(byteLength: number) {
  const encoder = new TextEncoder();
  const serialized = JSON.stringify({ padding: "x".repeat(byteLength) });
  const midpoint = Math.floor(serialized.length / 2);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(serialized.slice(0, midpoint)));
      controller.enqueue(encoder.encode(serialized.slice(midpoint)));
      controller.close();
    },
  });

  return new Request("https://ssartnership.example/api/member-test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

test("회원 및 수료생 JSON route는 공용 4KiB reader와 413 계약을 사용한다", async () => {
  for (const contract of ROUTE_CONTRACTS) {
    const source = await readSource(contract.path);
    const parserIndex = source.indexOf("await readRouteJsonBodyWithinLimit");

    assert.ok(parserIndex >= 0, `${contract.path}: bounded parser 누락`);
    assert.match(source, /MAX_STANDARD_JSON_BODY_BYTES/);
    assert.match(source, /error instanceof RouteJsonBodyError/);
    assert.match(source, /error\.code === "body_too_large"/);
    assert.match(source, /\{ status: (?:error\.status|413) \}/);
    assert.match(source, /tooLargeMessage: "요청 본문이 너무 큽니다\."/);
    assert.ok(
      source.includes(`invalidMessage: ${JSON.stringify(contract.invalidMessage)}`) ||
        source.includes(`invalidMessage: ${contract.invalidMessage}`),
      `${contract.path}: malformed JSON 메시지 계약 누락`,
    );
    assert.doesNotMatch(source, /request\.json\(/);

    for (const token of contract.beforeParser) {
      const tokenIndex = source.indexOf(token);
      assert.ok(
        tokenIndex >= 0 && tokenIndex < parserIndex,
        `${contract.path}: ${token}은 본문 파싱 전에 유지되어야 함`,
      );
    }
    for (const token of contract.afterParser) {
      const tokenIndex = source.indexOf(token);
      assert.ok(
        tokenIndex > parserIndex,
        `${contract.path}: ${token}은 기존처럼 본문 파싱 뒤에 유지되어야 함`,
      );
    }
  }
});

test("공용 reader는 선언 길이와 streamed 길이 초과를 모두 413 오류로 구분한다", async () => {
  const requests = [
    new Request("https://ssartnership.example/api/member-test", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(MAX_STANDARD_JSON_BODY_BYTES + 1),
      },
      body: "{}",
    }),
    createStreamedRequest(MAX_STANDARD_JSON_BODY_BYTES),
  ];

  for (const request of requests) {
    await assert.rejects(
      readJsonRequestBodyWithinLimit(
        request,
        MAX_STANDARD_JSON_BODY_BYTES,
      ),
      (error: unknown) =>
        error instanceof JsonRequestBodyError &&
        error.code === "body_too_large" &&
        error.message === "요청 본문이 너무 큽니다.",
    );
  }
});

test("수료생 신청의 최대 정상 payload는 일반 4KiB cap 안에 들어온다", () => {
  const payload = JSON.stringify({
    certificateUploadId: "00000000-0000-4000-8000-000000000000",
    profileImageUploadId: "11111111-1111-4111-8111-111111111111",
    profileImageUploadSource: "common",
    email: `${"a".repeat(64)}@example.com`,
    legalName: "가".repeat(100),
    educationStartYear: 2024,
    educationStartMonth: 1,
    educationEndYear: 2024,
    educationEndMonth: 12,
    campus: "서울",
    consented: true,
  });

  assert.ok(
    new TextEncoder().encode(payload).byteLength <
      MAX_STANDARD_JSON_BODY_BYTES,
  );
});
