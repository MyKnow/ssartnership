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
// <label>은 첫 번째 labelable 자손 하나에만 이름을 붙인다.
const LABELABLE_TAG = /^(?:button|input|select|textarea|Button)$|(?:Input|Select|Textarea)$/;

type JsxTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement;
type UnlabeledSelect = { file: string; line: number };

/**
 * partner-card-form/FieldGroup은 <label>로 감싸지 않고, `name` 문자열 prop을 가진
 * 첫 직계 자식에만 htmlFor를 연결한다(그 외에는 fieldset/legend라 컨트롤 이름이 없다).
 */
function usesHtmlForFieldGroup(file: string, text: string) {
  const source = /import FieldGroup from "([^"]+)";/.exec(text)?.[1];
  return (
    source === "@/components/partner-card-form/FieldGroup" ||
    (source === "./FieldGroup" && file.replaceAll("\\", "/").includes("partner-card-form/"))
  );
}

function jsxAttribute(node: JsxTag, name: string, sourceFile: ts.SourceFile) {
  return node.attributes.properties
    .filter(ts.isJsxAttribute)
    .find((attribute) => attribute.name.getText(sourceFile) === name);
}

function firstLabelableElement(wrapper: ts.JsxElement, sourceFile: ts.SourceFile) {
  let first: JsxTag | undefined;
  const visit = (node: ts.Node) => {
    if (first) return;
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      LABELABLE_TAG.test(node.tagName.getText(sourceFile)) &&
      jsxAttribute(node, "type", sourceFile)?.initializer?.getText(sourceFile) !== '"hidden"'
    ) {
      first = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  wrapper.children.forEach(visit);
  return first;
}

/** React Children.toArray 기준 직계 자식(조건부 표현식은 통과, Fragment는 펼치지 않음) 중 name을 가진 첫 요소. */
function firstNamedDirectChild(wrapper: ts.JsxElement, sourceFile: ts.SourceFile) {
  const children: JsxTag[] = [];
  const collect = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      children.push(node.openingElement);
    } else if (ts.isJsxSelfClosingElement(node)) {
      children.push(node);
    } else if (
      ts.isJsxExpression(node) ||
      ts.isConditionalExpression(node) ||
      ts.isBinaryExpression(node) ||
      ts.isParenthesizedExpression(node)
    ) {
      ts.forEachChild(node, collect);
    }
  };
  wrapper.children.forEach(collect);
  return children.find((child) => jsxAttribute(child, "name", sourceFile));
}

function findUnlabeledSelects(file: string, text: string): UnlabeledSelect[] {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const htmlForFieldGroup = usesHtmlForFieldGroup(file, text);
  const unlabeled: UnlabeledSelect[] = [];

  const visit = (node: ts.Node, ancestors: ts.Node[]) => {
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      node.tagName.getText(sourceFile) === "Select"
    ) {
      const idInitializer = jsxAttribute(node, "id", sourceFile)?.initializer?.getText(sourceFile);
      const wrapper = [...ancestors].reverse().find(
        (ancestor): ancestor is ts.JsxElement =>
          ts.isJsxElement(ancestor) &&
          (ancestor.openingElement.tagName.getText(sourceFile) === "label" ||
            LABEL_WRAPPER_COMPONENT.test(ancestor.openingElement.tagName.getText(sourceFile))),
      );
      const labelledByWrapper =
        wrapper !== undefined &&
        (htmlForFieldGroup && wrapper.openingElement.tagName.getText(sourceFile) === "FieldGroup"
          ? firstNamedDirectChild(wrapper, sourceFile) === node
          : firstLabelableElement(wrapper, sourceFile) === node);
      const labelled =
        jsxAttribute(node, "aria-label", sourceFile) !== undefined ||
        jsxAttribute(node, "aria-labelledby", sourceFile) !== undefined ||
        (idInitializer !== undefined && text.includes(`htmlFor=${idInitializer}`)) ||
        labelledByWrapper;
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
          <label>기간<Input name="from" /><Select name="unit" /></label>
          <label>유형<input type="hidden" name="scope" /><Select name="type" /></label>
        </div>
      );
    }`,
  );
  // <label>은 첫 labelable 자손만 이름을 받으므로 Input 뒤의 Select(8행)는 이름이 없다.
  // hidden input은 labelable이 아니어서 9행 Select는 라벨을 받는다.
  assert.deepEqual(found.map(({ line }) => line), [5, 8]);
});

test("partner-card-form FieldGroup은 name을 가진 첫 직계 자식 Select만 라벨로 인정한다", () => {
  const found = findUnlabeledSelects(
    "components/partner-card-form/Fixture.tsx",
    `import FieldGroup from "@/components/partner-card-form/FieldGroup";
    export function B() {
      return (
        <div>
          <FieldGroup label="노출 상태"><Select name="visibility" /></FieldGroup>
          <FieldGroup label="정렬"><Select value="a" /></FieldGroup>
          <FieldGroup label="카테고리"><div><Select name="categoryId" /></div></FieldGroup>
          <FieldGroup label="운영 형태">{enabled ? <Select name="serviceMode" /> : null}</FieldGroup>
        </div>
      );
    }`,
  );
  // name이 없거나(6행) 직계 자식이 아니면(7행) fieldset/legend로 렌더되어 컨트롤 이름이 없다.
  assert.deepEqual(found.map(({ line }) => line), [6, 7]);
});
