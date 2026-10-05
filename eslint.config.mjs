// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Repository-approved location for private QA logs and retained builds.
    // These are artifacts, never application or controller source.
    ".tmp/**",
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "storybook-static/**",
    ".next-e2e/**",
    ".next-perf-review/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "playwright-results.xml",
  ]),
  // Vendored upstream CommonJS syntax is part of its pinned package contract.
  { files: ["vendor/braces-depth-guard/**/*.js"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  ...storybook.configs["flat/recommended"],
  { files: ["src/lib/**/*.{ts,tsx}"], rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/components/*", "**/components/**"], message: "Domain/read-model code must not import UI components." }] }] } },
  {
    // Server code: an unawaited promise or a swallowed rejection hides a
    // failure from the structured server log. Measured 0 floating promises
    // in this scope on 2026-10-05 (Issue #543); keep the rule type-aware and
    // limited to server lib/API code so client lint stays fast.
    files: ["src/lib/**/*.{ts,tsx}", "src/app/api/**/*.{ts,tsx}"],
    ignores: ["**/*.stories.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "warn",
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[params.length=0][body.type='Identifier'][body.name='undefined']",
          message:
            "실패를 조용히 버리지 말고 logServerError 또는 expectNoError로 기록하세요. 의도한 무시라면 이유를 주석으로 남기세요.",
        },
        {
          selector:
            "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[params.length=0][body.type='Literal'][body.raw='null']",
          message:
            "실패를 null로 바꾸면 '없음'과 '조회 실패'가 구분되지 않습니다. 실패를 기록하거나 상태를 구분하세요.",
        },
      ],
    },
  },
]);

export default eslintConfig;
