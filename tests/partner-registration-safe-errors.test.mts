import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getSafePartnerRegistrationError } from "../src/lib/partner-registration-safe-errors.ts";

test("제휴 등록 액션은 내부 저장 오류를 일반 안내로 치환한다", () => {
  assert.deepEqual(
    getSafePartnerRegistrationError(
      new Error("duplicate key violates partner_registration_requests_pkey"),
      "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    ),
    { message: "신청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." },
  );
});

test("제휴 등록 액션은 지점 파일과 행 오류만 필드 안내로 유지한다", () => {
  assert.deepEqual(
    getSafePartnerRegistrationError(
      new Error("2번째 지점의 전화번호 형식을 확인해 주세요. 3번째 지점의 주소를 입력해 주세요."),
      "fallback",
    ),
    {
      message: "2번째 지점의 전화번호 형식을 확인해 주세요.",
      fieldErrors: {
        branchListText: "2번째 지점의 전화번호 형식을 확인해 주세요.",
      },
    },
  );
  assert.deepEqual(
    getSafePartnerRegistrationError(
      new Error("지점 XLSX 파일은 1MB 이하만 업로드할 수 있습니다."),
      "fallback",
    ),
    {
      message: "지점 XLSX 파일은 1MB 이하만 업로드할 수 있습니다.",
      fieldErrors: {
        branchListText: "지점 XLSX 파일은 1MB 이하만 업로드할 수 있습니다.",
      },
    },
  );
});

test("공개·파트너 등록 액션은 raw error.message를 응답에 전달하지 않는다", async () => {
  const root = new URL("..", import.meta.url);
  const sources = await Promise.all([
    readFile(
      new URL("src/app/(site)/partner-registration/actions.ts", root),
      "utf8",
    ),
    readFile(
      new URL(
        "src/app/partner/companies/[companyId]/services/new/actions.ts",
        root,
      ),
      "utf8",
    ),
  ]);

  for (const source of sources) {
    assert.match(source, /getSafePartnerRegistrationError/);
    assert.doesNotMatch(source, /message\.includes\("지점"\)/);
    assert.doesNotMatch(source, /error instanceof Error && error\.message/);
  }
});
