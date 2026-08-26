import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("관리자 저장 버튼은 수정 폼 안에 남아 실제 Server Action을 제출한다", async () => {
  const [form, formActions] = await Promise.all([
    readFile(
      new URL("../src/components/partner-card-form/PartnerCardForm.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/components/partner-card-form/PartnerFormActions.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    form,
    /const formId = `partner-card-form-\$\{mode\}-\$\{partner\.id \?\? "new"\}`/,
  );
  assert.match(form, /<form[\s\S]*?id=\{formId\}/);
  assert.match(formActions, /pointer-events-none fixed[\s\S]*<SubmitButton/);
  assert.doesNotMatch(formActions, /form=\{formId\}/);
});
