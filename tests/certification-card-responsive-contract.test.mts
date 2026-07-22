import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("인증 카드 내부 크기는 cqw 기반 clamp로 제한된다", () => {
  const frame = readRepoFile("src/components/certification/CertificationCardFrame.tsx");
  const view = readRepoFile("src/components/certification/CertificationView.tsx");

  assert.match(frame, /clamp\([^)]*cqw/);
  assert.match(frame, /grid-cols-\[minmax\(0,1fr\)_clamp/);
  assert.match(frame, /flex-wrap/);
  assert.match(frame, /min-w-0/);
  assert.match(view, /line-clamp-1|truncate/);
});

test("인증 카드 cqw 패딩은 카드 폭을 제공하는 래퍼를 기준으로 계산된다", () => {
  const frame = readRepoFile("src/components/certification/CertificationCardFrame.tsx");

  assert.match(
    frame,
    /<div className="@container\/cert w-full max-w-full min-w-0">\s*<div\s+className=\{cn\(\s*"relative isolate/,
  );
  assert.doesNotMatch(frame, /cn\(\s*"@container\/cert relative isolate/);
});

test("전체 목업 grid는 카드가 충분한 폭일 때만 다열로 배치된다", () => {
  const mocks = readRepoFile("src/components/admin/AdminAllCertificationCardMocks.tsx");

  assert.match(
    mocks,
    /\[grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,27rem\),1fr\)\)\]/,
  );
  assert.doesNotMatch(mocks, /sm:grid-cols-2/);
});

test("인증 카드 소형 화면도 동일한 행 구조를 cqw로 축소한다", () => {
  const frame = readRepoFile("src/components/certification/CertificationCardFrame.tsx");
  const styles = readRepoFile("src/app/globals.css");

  assert.match(frame, /grid-cols-\[minmax\(0,1fr\)_minmax\(0,auto\)\]/);
  assert.match(frame, /text-\[clamp\(0px,6cqw,5rem\)\]/);
  assert.doesNotMatch(
    styles,
    /@container cert \(max-width: 34rem\)[\s\S]*\.certification-card-identity-header\s*\{/
  );
});

test("파트너 이미지 캐러셀은 대표 이미지만 1:1, 추가 이미지는 4:3 프레임을 유지한다", () => {
  const carousel = readRepoFile("src/components/PartnerImageCarousel.tsx");

  assert.match(
    carousel,
    /const imageAspectClassName = variant === "hero"\s*\?\s*"aspect-square"\s*:\s*"aspect-\[4\/3\]"/,
  );
});

test("파트너 hero 메타 액션은 칩 높이에 맞추고 44px 터치 영역을 확장한다", () => {
  const meta = readRepoFile(
    "src/app/(site)/partners/[id]/_page/PartnerDetailHeroMeta.tsx",
  );
  const favorite = readRepoFile("src/components/partner-favorites/PartnerFavoriteButton.tsx");
  const share = readRepoFile("src/components/ShareLinkButton.tsx");

  assert.match(meta, /min-h-8 px-2\.5 py-1/);
  assert.match(meta, /after:min-h-11 after:min-w-11/);
  assert.match(meta, /!relative !h-8 !min-h-0 !min-w-0/);
  assert.match(favorite, /className\?: string/);
  assert.match(share, /className\?: string/);
});

test("파트너 혜택 이용 FAB는 화면 우측에 고정된다", () => {
  const actionBar = readRepoFile(
    "src/app/(site)/partners/[id]/_page/PartnerDetailMobileActionBar.tsx",
  );

  assert.match(actionBar, /right-6/);
  assert.doesNotMatch(actionBar, /right-\[max\(/);
});

test("혜택 이용 인증 카드는 모든 화면에서 16:9 비율을 유지한다", () => {
  const verification = readRepoFile(
    "src/components/partner/PartnerBenefitVerificationView.tsx",
  );

  assert.match(verification, /cardClassName="!aspect-\[16\/9\]"/);
  assert.doesNotMatch(verification, /!aspect-\[16\/10\]/);
});

test("인증 카드 footer의 행과 QR 컨트롤도 카드 폭에 맞춰 cqw로 축소된다", () => {
  const view = readRepoFile("src/components/certification/CertificationView.tsx");

  assert.match(view, /leading-\[clamp\(0px,3cqw,1\.5rem\)\]/);
  assert.match(view, /!h-\[clamp\(0px,5\.9cqw,4rem\)\]/);
  assert.match(view, /!px-\[clamp\(0px,2\.1cqw,2\.1rem\)\]/);
});

test("인증 카드의 긴 한국어와 footer는 카드 밖으로 넘치지 않도록 제한된다", () => {
  const frame = readRepoFile("src/components/certification/CertificationCardFrame.tsx");
  const verifyPage = readRepoFile("src/app/(site)/verify/[token]/page.tsx");

  assert.match(frame, /max-w-full/);
  assert.match(frame, /max-h-full|overflow-hidden/);
  assert.match(verifyPage, /min-w-0/);
  assert.match(verifyPage, /truncate|overflow-wrap|break-keep/);
});
