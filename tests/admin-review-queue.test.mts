import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const queueSourcePaths = [
  "../src/components/admin/AdminPartnerRegistrationsView.tsx",
  "../src/app/admin/(protected)/partner-requests/page.tsx",
  "../src/components/admin/AdminGraduateVerificationQueue.tsx",
  "../src/components/admin/AdminProfilePhotoReviewQueue.tsx",
  "../src/components/admin/AdminMemberSignupApprovalQueue.tsx",
].map((path) => new URL(path, import.meta.url));

test("검토 큐 피드백은 허용된 코드만 안전한 안내로 변환한다", async () => {
  const { appendAdminReviewQueueQuery, getAdminReviewQueueFeedback } = await import(
    new URL("../src/lib/admin-review-queue.ts", import.meta.url).href,
  );

  assert.deepEqual(getAdminReviewQueueFeedback({ success: "approved" }), {
    tone: "success",
    title: "처리 완료",
    description: "검토 항목을 승인했습니다.",
  });
  assert.equal(
    getAdminReviewQueueFeedback({ error: "database password leaked" })?.description,
    "잠시 후 다시 시도해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요.",
  );
  assert.equal(
    getAdminReviewQueueFeedback({ error: "unknown_internal_code" })?.description,
    "잠시 후 다시 시도해 주세요. 문제가 계속되면 운영 기록을 확인해 주세요.",
  );
  assert.equal(
    appendAdminReviewQueueQuery("/admin/queue?page=2", { success: "approved" }),
    "/admin/queue?page=2&success=approved",
  );
});

test("대표 검토 큐는 공통 헤더와 상태 피드백 계약을 사용한다", async () => {
  const sources = await Promise.all(
    queueSourcePaths.map((path) => readFile(path, "utf8")),
  );

  for (const source of sources) {
    assert.match(source, /AdminReviewQueueHeader/);
  }

  const partnerRequestsPage = sources[1];
  assert.match(partnerRequestsPage, /getAdminPartnerChangeRequestQueueReadModel/);
  assert.match(partnerRequestsPage, /parseAdminReviewQueuePagination/);
  assert.doesNotMatch(partnerRequestsPage, /throw new Error/);
});

test("결정 액션은 대상 항목의 제출 상태를 표시하고 목록 맥락을 보존한다", async () => {
  const [partnerQueue, signupQueue, signupDetail, partnerActions, graduateActions, photoActions] = await Promise.all([
    readFile(
      new URL(
        "../src/components/admin/PartnerChangeRequestQueue.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(queueSourcePaths[4], "utf8"),
    readFile(
      new URL(
        "../src/components/admin/AdminMemberSignupApprovalDetail.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/(protected)/_actions/partner-actions/review.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/(protected)/graduate-verifications/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/(protected)/profile-photos/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(partnerQueue, /<input[^>]+name="returnTo"/);
  assert.match(partnerQueue, /<SubmitButton/);
  assert.match(partnerQueue, /buildQueuePageHref/);
  assert.match(partnerActions, /sanitizeReturnTo/);
  assert.match(signupQueue, /returnTo/);
  assert.match(signupDetail, /name="returnTo"/);
  assert.match(graduateActions, /redirectAdminActionError/);
  assert.match(graduateActions, /appendAdminReviewQueueQuery/);
  assert.doesNotMatch(graduateActions, /throw new Error/);
  assert.match(photoActions, /redirectAdminActionError/);
  assert.match(photoActions, /appendAdminReviewQueueQuery/);
  assert.doesNotMatch(photoActions, /throw new Error/);
});

test("가입 승인 상세의 반려 입력은 같은 화면 복구와 접근 가능한 한국어 안내를 제공한다", async () => {
  const [detailSource, pageSource] = await Promise.all([
    readFile(
      new URL(
        "../src/components/admin/AdminMemberSignupApprovalDetail.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/(protected)/member-signup-requests/[requestId]/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(detailSource, /from "@\/components\/ui\/Textarea"/);
  assert.match(detailSource, /<fieldset/);
  assert.match(detailSource, /<legend/);
  assert.match(detailSource, /htmlFor=\{rejectionReasonId\}/);
  assert.match(detailSource, /반려 사유를 1~500자로 입력해 주세요/);
  assert.match(detailSource, /aria-invalid=\{focusRejectReason \|\| undefined\}/);
  assert.match(detailSource, /autoFocus=\{focusRejectReason\}/);
  assert.doesNotMatch(detailSource, /<textarea name="reason"/);
  assert.match(pageSource, /focusRejectReason=\{query\.error === "invalid_reason"\}/);
});

test("프로필 사진 반려 입력은 실패한 카드로 복구하고 접근 가능한 한국어 안내를 제공한다", async () => {
  const [queueSource, pageSource, actionSource] = await Promise.all([
    readFile(queueSourcePaths[3], "utf8"),
    readFile(
      new URL(
        "../src/app/admin/(protected)/profile-photos/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/(protected)/profile-photos/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(queueSource, /from "@\/components\/ui\/Textarea"/);
  assert.match(queueSource, /focusReasonTarget/);
  assert.match(queueSource, /반려 사유를 1~500자로 입력해 주세요/);
  assert.match(queueSource, /aria-invalid=\{isReasonInvalid \|\| undefined\}/);
  assert.match(queueSource, /autoFocus=\{isReasonInvalid\}/);
  assert.doesNotMatch(queueSource, /<input\s+id=\{`(?:replacement|current-photo)-reason-/);
  assert.match(pageSource, /focusReasonTarget=\{params\.focus/);
  assert.match(actionSource, /appendAdminReviewQueueQuery\(returnTo, \{ focus: reasonFieldId \}\)/);
});

test("관리자 라우트 오류 화면은 내부 오류 메시지를 렌더링하지 않는다", async () => {
  const source = await readFile(
    new URL("../src/app/admin/(protected)/error.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /다시 시도/);
  assert.doesNotMatch(source, /error\.message/);
});
