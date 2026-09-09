import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");

function readRepoFile(relativePath: string) {
  return readFileSync(path.join(repositoryRoot, relativePath), "utf8");
}

test("파트너 리뷰는 단일 컨테이너 안에서 리뷰 항목만 Divider로 구분한다", () => {
  const section = readRepoFile(
    "src/components/partner-reviews/PartnerReviewSection.tsx",
  );
  const summary = readRepoFile(
    "src/components/partner-reviews/PartnerReviewSummaryCard.tsx",
  );
  const reviewCard = readRepoFile(
    "src/components/partner-reviews/PartnerReviewCard.tsx",
  );

  assert.match(
    section,
    /<Card[\s\S]*data-partner-review-container[\s\S]*padding="none"/,
  );
  assert.match(section, /data-partner-review-summary/);
  assert.match(section, /data-partner-review-filters/);
  assert.match(section, /data-partner-review-list/);
  assert.equal(
    [...section.matchAll(/<ReviewSectionDivider\s*\/>/g)].length,
    2,
  );
  assert.match(section, /<ReviewItemDivider\s*\/>/);
  assert.doesNotMatch(section, /<span className="ui-caption">목록<\/span>/);
  assert.doesNotMatch(section, /const listDescription/);
  assert.match(
    section,
    /<span className="ui-caption">필터<\/span>[\s\S]*사진이 있는 리뷰만 보기[\s\S]*<span className="ui-caption">정렬<\/span>/,
  );
  assert.match(
    section,
    /<PartnerReviewSummaryCard\s+summary=\{summary\}\s+embedded\s*\/>/,
  );
  assert.match(
    section,
    /const reviewWriteLoginHref = `\/auth\/login\?returnTo=\$\{encodeURIComponent\(`\/partners\/\$\{encodeURIComponent\(partnerId\)\}`\)\}`;/,
  );
  assert.match(
    section,
    /<Button variant="secondary" href=\{reviewWriteLoginHref\}>\s*로그인 후 리뷰 작성\s*<\/Button>/,
  );
  assert.match(section, /const activeListRequestIdRef = useRef\(0\)/);
  assert.match(section, /const activeListRequestAbortControllerRef = useRef<AbortController \| null>\(null\)/);
  assert.match(section, /activeListRequestAbortControllerRef\.current\?\.abort\(\)/);
  assert.match(section, /const requestId = activeListRequestIdRef\.current \+= 1/);
  assert.match(section, /signal: controller\.signal/);
  assert.match(section, /if \(requestId !== activeListRequestIdRef\.current\) \{\s*return;\s*\}/);
  assert.match(section, /const listBusy = pendingMode !== "idle";/);
  assert.match(section, /if \(reactingReviewId !== null\) \{\s*return;\s*\}/);
  assert.match(section, /reactionPending=\{reactingReviewId !== null\}/);
  assert.match(section, /리뷰 삭제 중 네트워크 오류/);
  assert.match(section, /리뷰 상태 변경 중 네트워크 오류/);
  assert.match(section, /리뷰 반응 처리 중 네트워크 오류/);

  const imageFilterHandler = section.match(
    /type="checkbox"[\s\S]*?onChange=\{\(event\) => \{([\s\S]*?)\n\s*\}\}/,
  )?.[1];
  assert.ok(imageFilterHandler);
  assert.doesNotMatch(imageFilterHandler, /setOnlyWithImages\(/);
  assert.match(section, /<PartnerReviewCard[\s\S]*embedded/);
  assert.match(section, /className="py-5 first:pt-0 last:pb-0"/);
  assert.doesNotMatch(section, /index === reviews\.length - 1/);
  assert.match(summary, /embedded = false/);
  assert.match(summary, /data-partner-review-summary-content/);
  assert.doesNotMatch(summary, /비공개 리뷰 제외/);
  assert.match(reviewCard, /embedded = false/);
  assert.match(reviewCard, /data-partner-review-item/);
  assert.match(reviewCard, /if \(embedded\)/);
});
