import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  DIALOG_FOCUSABLE_SELECTOR,
  createDialogStack,
  resolveDialogTabTarget,
} from "../src/lib/dialog-focus.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("Tab은 마지막 조작 요소에서 첫 요소로, Shift+Tab은 첫 요소에서 마지막으로 순환한다", () => {
  const container = "panel";
  const focusables = ["close", "input", "submit"];

  assert.equal(resolveDialogTabTarget(focusables, "submit", false, container), "close");
  assert.equal(resolveDialogTabTarget(focusables, "close", true, container), "submit");
  assert.equal(resolveDialogTabTarget(focusables, "input", false, container), null);
  assert.equal(resolveDialogTabTarget(focusables, "input", true, container), null);
});

test("포커스가 컨테이너 자체나 바깥에 있으면 방향에 맞는 끝 요소로 되돌린다", () => {
  const focusables = ["close", "confirm"];
  assert.equal(resolveDialogTabTarget(focusables, "panel", false, "panel"), "close");
  assert.equal(resolveDialogTabTarget(focusables, "panel", true, "panel"), "confirm");
  assert.equal(resolveDialogTabTarget(focusables, null, false, "panel"), "close");
});

test("조작 요소가 없으면 컨테이너에 포커스를 묶어 둔다", () => {
  assert.equal(resolveDialogTabTarget([], "anything", false, "panel"), "panel");
});

test("겹친 다이얼로그는 가장 위의 것만 키보드 입력을 처리한다", () => {
  const stack = createDialogStack();
  const sheet = Symbol("sheet");
  const confirm = Symbol("confirm");

  stack.push(sheet);
  assert.ok(stack.isTop(sheet));
  stack.push(confirm);
  assert.ok(!stack.isTop(sheet));
  assert.ok(stack.isTop(confirm));

  stack.remove(confirm);
  assert.ok(stack.isTop(sheet));
  stack.remove(sheet);
  assert.equal(stack.size, 0);
  assert.ok(!stack.isTop(sheet));
});

test("조작 요소 선택자는 tabindex=-1 링크와 비활성 컨트롤을 제외한다", () => {
  assert.match(DIALOG_FOCUSABLE_SELECTOR, /a\[href\]:not\(\[tabindex='-1'\]\)/);
  assert.match(DIALOG_FOCUSABLE_SELECTOR, /button:not\(\[disabled\]\)/);
});

test("수동 다이얼로그는 공용 포커스 훅으로 초기 포커스·순환·복원·Escape를 처리한다", () => {
  const hook = read("src/hooks/useDialogFocus.ts");
  assert.match(hook, /dialogStack\.push\(token\)/);
  assert.match(hook, /dialogStack\.isTop\(token\)/);
  assert.match(hook, /event\.key === "Escape"/);
  assert.match(hook, /opener\.focus\(\{ preventScroll: true \}\)/);

  for (const path of [
    "src/components/ui/Modal.tsx",
    "src/components/certification/CertificationQrButton.tsx",
    "src/components/certification/CertificationView.tsx",
    "src/components/partner/PartnerBenefitUseAction.tsx",
    "src/components/partner-image-carousel/LightboxModal.tsx",
    "src/components/media/ImageCropDialog.tsx",
  ]) {
    const source = read(path);
    assert.match(source, /useDialogFocus\(\{/, `${path}: useDialogFocus 사용`);
    assert.match(source, /tabIndex=\{-1\}/, `${path}: 컨테이너 폴백 포커스`);
    assert.doesNotMatch(
      source,
      /event\.key === "Escape"/,
      `${path}: Escape는 공용 훅만 처리한다(중복 닫기 방지)`,
    );
  }

  const qr = read("src/components/certification/CertificationQrButton.tsx");
  assert.match(qr, /aria-labelledby=\{dialogTitleId\}/);
  assert.match(qr, /<h2 id=\{dialogTitleId\}/);

  // 이미지 편집은 취소 버튼과 같은 onCancel로 Escape를 닫고, 제목으로 dialog 이름을 준다.
  const crop = read("src/components/media/ImageCropDialog.tsx");
  assert.match(
    crop,
    /useDialogFocus\(\{ open: dialogOpen, containerRef: panelRef, onClose: onCancel \}\)/,
  );
  assert.match(
    crop,
    /ref=\{panelRef\}\s+role="dialog"\s+aria-modal="true"\s+aria-labelledby=\{titleId\}\s+tabIndex=\{-1\}/,
  );
  assert.match(crop, /<h2\s+id=\{titleId\}/);
});

test("관리자 로그 CSV 다운로드는 수동 오버레이 대신 ui/Modal을 쓴다", () => {
  const source = read("src/components/admin/logs/AdminLogsPanels.tsx");
  assert.match(source, /import Modal from '@\/components\/ui\/Modal';/);
  assert.match(source, /<Modal\s+open=\{open\}\s+title="CSV 다운로드"/);
  assert.doesNotMatch(source, /fixed inset-0/);
});

test("화면 전체를 덮는 오버레이는 dialog 의미를 가진다", () => {
  // 새 오버레이는 ui/Modal을 쓰거나, 직접 구현할 때 role="dialog"(또는 네이티브 <dialog>)와
  // useDialogFocus를 함께 둔다(docs/design-system/elements.md Feedback 규칙).
  const sourceRoot = new URL("../src/", import.meta.url);
  const offenders = readdirSync(sourceRoot, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".tsx") && !file.endsWith(".stories.tsx"))
    .filter((file) => {
      const source = readFileSync(new URL(file, sourceRoot), "utf8");
      return /\bfixed inset-0\b/.test(source) && !/role="dialog"|<dialog\b/.test(source);
    });

  assert.deepEqual(offenders, []);
});

test("수료생 사진 미리보기는 수동 dialog 대신 ui/Modal을 쓴다", () => {
  const source = read("src/components/graduate-verification/GraduateVerificationApplicationView.tsx");
  assert.match(source, /import Modal from "@\/components\/ui\/Modal";/);
  assert.match(source, /<Modal\s+open=\{photoPreviewOpen\}\s+title="선택한 본인 사진 확대"/);
  assert.doesNotMatch(source, /role="dialog"/);
});
