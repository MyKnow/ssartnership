import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

test("제휴처 폼 필드 그룹은 오류 설명과 레이블을 연결한다", async () => {
  const source = await readFile(
    new URL("../src/components/partner-card-form/FieldGroup.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /useId/);
  assert.match(source, /htmlFor=\{controlId\}/);
  assert.match(source, /"aria-describedby": describedBy/);
  assert.match(source, /<fieldset/);
  assert.match(source, /role="alert"/);
  assert.doesNotMatch(source, /return \(\s*<label className=/);
});

const LABEL_WRAPPER_COMPONENT = /^(?:FieldGroup|FieldLabel)$/;

type UnlabeledSelect = { file: string; line: number };

function findUnlabeledSelects(file: string, text: string): UnlabeledSelect[] {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const unlabeled: UnlabeledSelect[] = [];

  const visit = (node: ts.Node, ancestors: ts.Node[]) => {
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText(sourceFile) === "Select"
    ) {
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
      const attributeNames = attributes.map((attribute) => attribute.name.getText(sourceFile));
      const idInitializer = attributes
        .find((attribute) => attribute.name.getText(sourceFile) === "id")
        ?.initializer?.getText(sourceFile);
      const labelled =
        attributeNames.includes("aria-label") ||
        attributeNames.includes("aria-labelledby") ||
        (idInitializer !== undefined && text.includes(`htmlFor=${idInitializer}`)) ||
        ancestors.some(
          (ancestor) =>
            ts.isJsxElement(ancestor) &&
            (ancestor.openingElement.tagName.getText(sourceFile) === "label" ||
              LABEL_WRAPPER_COMPONENT.test(ancestor.openingElement.tagName.getText(sourceFile))),
        );
      if (!labelled) {
        unlabeled.push({
          file,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        });
      }
    }
    ts.forEachChild(node, (child) => visit(child, [...ancestors, node]));
  };

  visit(sourceFile, []);
  return unlabeled;
}

test("공용 Select는 name이나 고정 문구로 접근 이름을 채우지 않는다", async () => {
  const source = await readFile(
    new URL("../src/components/ui/Select.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(source, /aria-label=\{ariaLabel \?\? name/);
  assert.doesNotMatch(source, /"옵션 선택"/);
});

test("모든 ui/Select 호출처는 보이는 label·FieldGroup·aria-label 중 하나로 이름을 가진다", async () => {
  const sourceRoot = new URL("../src/", import.meta.url);
  const files = (await readdir(sourceRoot, { recursive: true })).filter((file) =>
    file.endsWith(".tsx"),
  );
  const unlabeled: UnlabeledSelect[] = [];
  let selectFileCount = 0;

  for (const file of files) {
    const text = await readFile(new URL(file, sourceRoot), "utf8");
    if (!text.includes("<Select") || !/from "@\/components\/ui\/Select"|from "\.\/Select"/.test(text)) {
      continue;
    }
    selectFileCount += 1;
    unlabeled.push(...findUnlabeledSelects(file, text));
  }

  assert.ok(selectFileCount >= 30, "Select 호출처 스캔 범위가 비정상적으로 줄었다");
  assert.deepEqual(
    unlabeled.map(({ file, line }) => `${file}:${line}`),
    [],
    "라벨 없는 Select에는 한국어 aria-label 또는 <label>을 붙인다",
  );
});

test("라벨 스캔은 이름 없는 Select를 실제로 찾아낸다", () => {
  const found = findUnlabeledSelects(
    "fixture.tsx",
    `export function A() {
      return (
        <div>
          <label>정렬<Select value="a" /></label>
          <Select name="visibility" />
          <Select aria-label="상태" />
          <FieldGroup label="카테고리"><Select name="categoryId" /></FieldGroup>
        </div>
      );
    }`,
  );
  assert.deepEqual(found.map(({ line }) => line), [5]);
});
