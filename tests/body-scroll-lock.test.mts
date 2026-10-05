import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { createScrollLockRegistry } from "../src/lib/body-scroll-lock.ts";

test("단일 잠금은 overflow를 hidden으로 바꾸고 해제 시 원래 값을 복원한다", () => {
  const registry = createScrollLockRegistry();
  const body = { style: { overflow: "auto" } };

  const release = registry.acquire(body);
  assert.equal(body.style.overflow, "hidden");
  assert.equal(registry.activeCount, 1);

  release();
  assert.equal(body.style.overflow, "auto");
  assert.equal(registry.activeCount, 0);
});

test("겹친 오버레이 중 먼저 연 쪽이 먼저 닫혀도 마지막 해제 전까지 잠금이 유지된다", () => {
  const registry = createScrollLockRegistry();
  const body = { style: { overflow: "" } };

  const releaseSheet = registry.acquire(body);
  const releaseConfirm = registry.acquire(body);
  assert.equal(registry.activeCount, 2);

  releaseSheet();
  assert.equal(body.style.overflow, "hidden", "아직 열린 오버레이 아래에서 스크롤이 풀리면 안 된다");

  releaseConfirm();
  assert.equal(body.style.overflow, "");
});

test("같은 해제 함수를 두 번 불러도 다른 잠금의 카운트를 깎지 않는다", () => {
  const registry = createScrollLockRegistry();
  const body = { style: { overflow: "scroll" } };

  const releaseFirst = registry.acquire(body);
  const releaseSecond = registry.acquire(body);
  releaseFirst();
  releaseFirst();
  assert.equal(registry.activeCount, 1);
  assert.equal(body.style.overflow, "hidden");

  releaseSecond();
  assert.equal(body.style.overflow, "scroll");
});

test("잠금이 모두 풀린 뒤 다시 잠그면 그 시점의 값을 새로 기억한다", () => {
  const registry = createScrollLockRegistry();
  const body = { style: { overflow: "" } };

  registry.acquire(body)();
  body.style.overflow = "clip";
  const release = registry.acquire(body);
  release();
  assert.equal(body.style.overflow, "clip");
});

test("앱 코드는 body overflow를 직접 쓰지 않고 공용 잠금 훅을 쓴다", () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const offenders = readdirSync(sourceRoot, { recursive: true, encoding: "utf8" })
    .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".stories.tsx"))
    .filter((file) => file !== "lib/body-scroll-lock.ts")
    .filter((file) =>
      /document\.body\.style\.overflow\s*=/.test(readFileSync(new URL(file, sourceRoot), "utf8")),
    );

  assert.deepEqual(offenders, []);
  for (const file of [
    "components/ui/Modal.tsx",
    "components/TabletMenu.tsx",
    "components/admin/AdminQuickNavigator.tsx",
    "components/admin/AdminMobileNav.tsx",
    "components/certification/CertificationQrButton.tsx",
    "components/certification/CertificationView.tsx",
    "components/media/ImageCropDialog.tsx",
    "components/partner/PartnerBenefitUseAction.tsx",
    "components/partner-image-carousel/useCarouselController.ts",
    "components/partner-reviews/PartnerReviewLightbox.tsx",
  ]) {
    assert.match(
      readFileSync(new URL(file, sourceRoot), "utf8"),
      /useBodyScrollLock\(/,
      `${file}: 공용 잠금 훅 호출`,
    );
  }
  const hook = readFileSync(new URL("hooks/useBodyScrollLock.ts", sourceRoot), "utf8");
  assert.match(hook, /bodyScrollLockRegistry\.acquire\(document\.body\)/);
});

test("오버레이 안의 스크롤 영역은 overscroll-contain으로 배경 스크롤 체이닝을 막는다", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  for (const [path, pattern] of [
    ["src/components/ui/Modal.tsx", /"mt-4 min-h-0 flex-1 overscroll-contain"/],
    ["src/components/admin/AdminMobileNav.tsx", /flex-1 overflow-y-auto overscroll-contain/],
    ["src/components/admin/AdminQuickNavigator.tsx", /min-h-0 overflow-y-auto overscroll-contain/],
    ["src/components/media/ImageCropDialog.tsx", /overflow-y-auto overscroll-contain/],
    ["src/components/partner/PartnerBenefitUseAction.tsx", /overflow-y-auto overscroll-contain/],
    ["src/components/certification/CertificationQrButton.tsx", /overflow-y-auto overscroll-contain/],
  ] as const) {
    assert.match(read(path), pattern, path);
  }
});
