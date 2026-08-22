import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getSafeAdminMessage,
  getSafeAdminResponseMessage,
} from "../src/lib/admin-safe-messages";

test("로그 화면은 네트워크·서버 내부 오류를 안전한 복구 안내로 바꾼다", () => {
  assert.equal(
    getSafeAdminMessage(
      new Error("fetch failed: ECONNRESET database.internal"),
      "로그 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    ),
    "로그 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  );
  assert.equal(
    getSafeAdminResponseMessage(
      "relation event_logs does not exist",
      "CSV 다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    ),
    "CSV 다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.",
  );
});

test("로그 조회와 내보내기는 안전한 메시지 계약과 최신 요청만 사용한다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/logs-manager/useAdminLogsManager.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /getSafeAdminMessage/);
  assert.match(source, /getSafeAdminResponseMessage/);
  assert.match(source, /AbortController/);
  assert.doesNotMatch(source, /setErrorMessage\(error instanceof Error \? error\.message/);
});

test("로그 API는 데이터 계층 예외를 안전한 응답으로 변환한다", async () => {
  const [readSource, exportSource] = await Promise.all([
    readFile(new URL("../src/app/api/admin/logs/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/logs/export/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(readSource, /로그를 불러오지 못했습니다\. 잠시 후 다시 시도해 주세요\./);
  assert.match(exportSource, /CSV 파일을 준비하지 못했습니다\. 잠시 후 다시 시도해 주세요\./);
});

test("제휴처 미리보기 링크 작업은 서버 예외 원문을 관리자에게 표시하지 않는다", async () => {
  const source = await readFile(
    new URL("../src/components/admin/AdminPartnerPreviewLinkPanel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /getSafeAdminMessage/);
  assert.doesNotMatch(source, /setMessage\(error instanceof Error \? error\.message/);
});

test("관리자 이미지 흐름은 변환·업로드 예외 원문 대신 복구 가능한 안내를 표시한다", async () => {
  const sources = await Promise.all([
    readFile(new URL("../src/components/admin/member-detail/AdminMemberProfilePhotoPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/partner-media-editor/useMediaFieldController.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/promotion-carousel-editor/PromotionCarouselEditor.tsx", import.meta.url), "utf8"),
  ]);
  const source = sources.join("\n");

  assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
  assert.doesNotMatch(source, /error instanceof Error && error\.message/);
  assert.doesNotMatch(source, /nextError instanceof Error && nextError\.message/);
  assert.doesNotMatch(source, /submitData\.message \?\?/);
});

test("회원 일괄 초대와 쿠폰 사전검증은 직접 Error.message를 렌더링하지 않는다", async () => {
  const sources = await Promise.all([
    readFile(new URL("../src/components/admin/AdminMemberManualAddPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/ad-packages/AdminPartnerCouponForm.tsx", import.meta.url), "utf8"),
  ]);
  const source = sources.join("\n");

  assert.doesNotMatch(source, /(?:error|caught) instanceof Error \? (?:error|caught)\.message/);
  assert.doesNotMatch(source, /throw new Error\(data\.message/);
});
