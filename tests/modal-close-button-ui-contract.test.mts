import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

test("공용 모달의 닫기 컨트롤은 접근 가능한 원형 X 아이콘 버튼이다", () => {
  const source = read("src/components/ui/Modal.tsx");
  const recipientPreviewSource = read(
    "src/components/admin/push-manager/PushComposerSection.tsx",
  );

  assert.match(source, /import \{ XMarkIcon \} from "@heroicons\/react\/24\/outline";/);
  assert.match(source, /aria-label="모달 닫기"/);
  assert.match(source, /h-11 w-11[^"\n]*rounded-full/);
  assert.match(source, /<XMarkIcon[^>]*aria-hidden="true"/);
  assert.doesNotMatch(source, />\s*닫기\s*<\/button>/);
  assert.doesNotMatch(recipientPreviewSource, />\s*닫기\s*<\/Button>/);
});
