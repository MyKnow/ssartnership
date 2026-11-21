import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";
import {
  FOCUS_RING_CLASS_NAME,
  FOCUS_RING_ON_BACKGROUND_CLASS_NAME,
  FOCUS_RING_ON_OVERLAY_CLASS_NAME,
} from "../src/components/ui/focus-ring.ts";

const root = new URL("..", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

const FOCUS_RING_PRIMITIVES = [
  "src/components/ui/Button.tsx",
  "src/components/ui/Input.tsx",
  "src/components/ui/Select.tsx",
  "src/components/ui/Textarea.tsx",
  "src/components/ui/PasswordInput.tsx",
  "src/components/ui/Modal.tsx",
] as const;

test("공용 포커스 링은 솔리드 ring 토큰과 강제 색상 모드 호환 outline을 쓴다", () => {
  for (const className of [
    FOCUS_RING_CLASS_NAME,
    FOCUS_RING_ON_BACKGROUND_CLASS_NAME,
    FOCUS_RING_ON_OVERLAY_CLASS_NAME,
  ]) {
    const tokens = className.split(" ");
    assert.ok(tokens.includes("focus-visible:ring-2"));
    assert.ok(tokens.includes("focus-visible:ring-ring"));
    assert.ok(tokens.includes("focus-visible:ring-offset-2"));
    assert.ok(tokens.includes("focus-visible:outline-hidden"));
    assert.ok(!tokens.some((token) => /ring-primary\//.test(token)));
    assert.ok(!tokens.includes("focus-visible:outline-none"));
  }
  assert.ok(
    FOCUS_RING_ON_BACKGROUND_CLASS_NAME.split(" ").includes(
      "focus-visible:ring-offset-background",
    ),
  );
  assert.ok(
    FOCUS_RING_ON_OVERLAY_CLASS_NAME.split(" ").includes(
      "focus-visible:ring-offset-surface-overlay",
    ),
  );
});

test("--focus-ring 토큰은 라이트·다크 모두 정의되고 Tailwind ring 색으로 노출된다", () => {
  const css = postcss.parse(read("src/app/globals.css"));
  const declarations = new Map<string, string>();
  css.walkDecls((declaration) => {
    const parent = declaration.parent;
    const scope =
      parent && parent.type === "rule"
        ? parent.selector
        : parent && parent.type === "atrule"
          ? `@${parent.name} ${parent.params}`
          : "";
    declarations.set(`${scope}|${declaration.prop}`, declaration.value);
  });

  assert.equal(declarations.get(":root|--focus-ring"), "#213b68");
  assert.equal(declarations.get("html.dark|--focus-ring"), "#d7e4ff");
  assert.equal(declarations.get("@theme inline|--color-ring"), "var(--focus-ring)");
});

test("6개 primitive는 공용 포커스 링을 쓰고 반투명 primary 링을 남기지 않는다", () => {
  for (const path of FOCUS_RING_PRIMITIVES) {
    const source = read(path);
    assert.match(
      source,
      /import \{ FOCUS_RING_ON_(BACKGROUND|OVERLAY)_CLASS_NAME \} from "@\/components\/ui\/focus-ring";/,
      `${path}: 공용 포커스 링 상수를 사용해야 한다`,
    );
    assert.doesNotMatch(source, /ring-primary\/\d+/, `${path}: 반투명 primary 링 금지`);
    assert.doesNotMatch(source, /focus(-visible)?:outline-none/, `${path}: outline-hidden 사용`);
  }
});

test("정의되지 않았던 ring-ring 사용처는 inset 링으로 정상화된다", () => {
  const source = read("src/components/admin/AdminPartnerRegistrationsView.tsx");
  assert.match(
    source,
    /<summary className="[^"]*rounded-card[^"]*focus-visible:ring-inset focus-visible:ring-ring/,
  );
});
