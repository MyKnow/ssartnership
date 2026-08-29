#!/usr/bin/env node

import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DOCUMENT_TYPES = new Set([
  "index",
  "security-policy",
  "product-contract",
  "guide",
  "requirement",
  "feature-spec",
  "implementation-plan",
  "task-list",
  "architecture",
  "decision",
  "exec-plan",
  "tech-debt",
  "runbook",
  "design-system",
  "test-guide",
  "baseline",
  "measurement",
  "audit",
  "report",
  "history",
]);

export const DOCUMENT_STATUSES = new Set([
  "current",
  "active",
  "completed",
  "superseded",
  "archived",
]);

export const DOCUMENT_AUTHORITIES = new Set([
  "normative",
  "descriptive",
  "evidence",
]);

function toRepositoryPath(rootDir, pathname) {
  return relative(rootDir, pathname).replaceAll("\\", "/");
}

function collectMarkdownFiles(directory) {
  const files = [];
  for (const name of readdirSync(directory).sort()) {
    const pathname = resolve(directory, name);
    if (statSync(pathname).isDirectory()) files.push(...collectMarkdownFiles(pathname));
    else if (name.endsWith(".md")) files.push(pathname);
  }
  return files;
}

export function parseDocumentFrontmatter(source) {
  if (!source.startsWith("---\n")) return { data: null, body: source };
  const end = source.indexOf("\n---\n", 4);
  if (end < 0) return { data: null, body: source };
  const data = {};
  for (const line of source.slice(4, end).split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = line.match(/^([a-z][a-z0-9_]*):\s*(.*?)\s*$/);
    if (!match) return { data: null, body: source };
    const raw = match[2];
    data[match[1]] = raw.replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
  }
  return { data, body: source.slice(end + 5) };
}

export function extractMarkdownLinks(source) {
  const links = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf("](", cursor);
    if (start < 0) break;
    let depth = 1;
    let end = start + 2;
    for (; end < source.length; end += 1) {
      if (source[end] === "\\") {
        end += 1;
        continue;
      }
      if (source[end] === "(") depth += 1;
      else if (source[end] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (depth !== 0) break;
    links.push({ target: source.slice(start + 2, end).trim(), offset: start });
    cursor = end + 1;
  }
  return links;
}

function lineNumberAt(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

function localTarget(rawTarget) {
  const unwrapped = rawTarget.startsWith("<") && rawTarget.endsWith(">")
    ? rawTarget.slice(1, -1)
    : rawTarget;
  if (!unwrapped || unwrapped.startsWith("#")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(unwrapped) || unwrapped.startsWith("//")) return null;
  const withoutFragment = unwrapped.split("#", 1)[0].split("?", 1)[0];
  return decodeURIComponent(withoutFragment);
}

function validatePathContract(repositoryPath, metadata, errors) {
  const fail = (message) => errors.push(`${repositoryPath}: ${message}`);
  if (repositoryPath.startsWith("docs/plans/active/") &&
      (metadata.type !== "exec-plan" || metadata.status !== "active")) {
    fail("plans/active 문서는 exec-plan/active여야 합니다.");
  }
  if (repositoryPath.startsWith("docs/plans/completed/") &&
      (metadata.type !== "exec-plan" || metadata.status !== "completed" || metadata.authority !== "evidence")) {
    fail("plans/completed 문서는 exec-plan/completed/evidence여야 합니다.");
  }
  if (repositoryPath.startsWith("docs/history/") && repositoryPath !== "docs/history/index.md" &&
      (metadata.type !== "history" || !["archived", "superseded"].includes(metadata.status) || metadata.authority !== "evidence")) {
    fail("history 문서는 history/archived|superseded/evidence여야 합니다.");
  }
  if (repositoryPath.includes("/audits/") &&
      (metadata.type !== "audit" || metadata.status !== "completed" || metadata.authority !== "evidence")) {
    fail("audits 문서는 audit/completed/evidence여야 합니다.");
  }
  if (repositoryPath.endsWith("/spec.md") && metadata.type !== "feature-spec") {
    fail("spec.md의 type은 feature-spec이어야 합니다.");
  }
  if (repositoryPath.endsWith("/plan.md") && metadata.type !== "implementation-plan") {
    fail("feature plan.md의 type은 implementation-plan이어야 합니다.");
  }
  if (repositoryPath.endsWith("/tasks.md") && metadata.type !== "task-list") {
    fail("tasks.md의 type은 task-list이어야 합니다.");
  }
}

export function validateDocumentation({ rootDir = process.cwd() } = {}) {
  const resolvedRoot = resolve(rootDir);
  const docsRoot = resolve(resolvedRoot, "docs");
  const errors = [];
  if (!existsSync(docsRoot)) return { errors: ["docs/: 문서 디렉터리가 없습니다."], documents: [] };

  const documents = collectMarkdownFiles(docsRoot).map((pathname) => {
    const source = readFileSync(pathname, "utf8");
    const repositoryPath = toRepositoryPath(resolvedRoot, pathname);
    const parsed = parseDocumentFrontmatter(source);
    return { pathname, repositoryPath, source, ...parsed };
  });
  const byPath = new Map(documents.map((document) => [document.pathname, document]));
  const graph = new Map(documents.map((document) => [document.pathname, new Set()]));

  for (const document of documents) {
    const { pathname, repositoryPath, source, data } = document;
    if (!data) {
      errors.push(`${repositoryPath}: 유효한 scalar frontmatter가 필요합니다.`);
      continue;
    }
    for (const key of ["title", "type", "status", "authority"]) {
      if (!data[key]) errors.push(`${repositoryPath}: frontmatter ${key} 값이 필요합니다.`);
    }
    if (data.type && !DOCUMENT_TYPES.has(data.type)) errors.push(`${repositoryPath}: 허용되지 않은 type ${data.type}`);
    if (data.status && !DOCUMENT_STATUSES.has(data.status)) errors.push(`${repositoryPath}: 허용되지 않은 status ${data.status}`);
    if (data.authority && !DOCUMENT_AUTHORITIES.has(data.authority)) errors.push(`${repositoryPath}: 허용되지 않은 authority ${data.authority}`);
    validatePathContract(repositoryPath, data, errors);

    if (data.status === "superseded") {
      if (!data.superseded_by) {
        errors.push(`${repositoryPath}: superseded 문서는 superseded_by가 필요합니다.`);
      } else {
        const replacement = resolve(dirname(pathname), data.superseded_by);
        if (!byPath.has(replacement)) errors.push(`${repositoryPath}: superseded_by 대상이 없습니다: ${data.superseded_by}`);
      }
    }

    const forbidden = [
      [/\/Users\/(?!\.\.\.)[^/\s]+\//, "macOS 개인 절대 경로"],
      [/[A-Za-z]:\\Users\\(?!\.\.\\)[^\\\s]+\\/, "Windows 개인 절대 경로"],
      [/file:\/\//i, "file URL"],
    ];
    for (const [pattern, label] of forbidden) {
      if (pattern.test(source)) errors.push(`${repositoryPath}: ${label}를 저장소 상대 경로로 바꿔야 합니다.`);
    }

    for (const link of extractMarkdownLinks(source)) {
      let target;
      try {
        target = localTarget(link.target);
      } catch {
        errors.push(`${repositoryPath}:${lineNumberAt(source, link.offset)}: link URL encoding이 유효하지 않습니다: ${link.target}`);
        continue;
      }
      if (target === null || target === "") continue;
      if (target.startsWith("/") || /^[A-Za-z]:[\\/]/.test(target)) {
        errors.push(`${repositoryPath}:${lineNumberAt(source, link.offset)}: 절대 로컬 링크를 사용할 수 없습니다: ${link.target}`);
        continue;
      }
      const resolvedTarget = resolve(dirname(pathname), target);
      const relativeTarget = relative(resolvedRoot, resolvedTarget);
      if (relativeTarget.startsWith("..") || resolve(resolvedRoot, relativeTarget) !== resolvedTarget) {
        errors.push(`${repositoryPath}:${lineNumberAt(source, link.offset)}: 저장소 밖 링크입니다: ${link.target}`);
        continue;
      }
      if (!existsSync(resolvedTarget)) {
        errors.push(`${repositoryPath}:${lineNumberAt(source, link.offset)}: 링크 대상이 없습니다: ${link.target}`);
        continue;
      }
      if (byPath.has(resolvedTarget)) graph.get(pathname).add(resolvedTarget);
    }
  }

  const entrypoint = resolve(docsRoot, "index.md");
  if (!byPath.has(entrypoint)) {
    errors.push("docs/index.md: Repository Knowledge 진입점이 필요합니다.");
  } else {
    const reachable = new Set();
    const queue = [entrypoint];
    while (queue.length > 0) {
      const current = queue.shift();
      if (reachable.has(current)) continue;
      reachable.add(current);
      queue.push(...(graph.get(current) ?? []));
    }
    for (const document of documents) {
      if (document.data?.authority === "normative" &&
          ["current", "active"].includes(document.data.status) &&
          !reachable.has(document.pathname)) {
        errors.push(`${document.repositoryPath}: docs/index.md에서 도달할 수 없는 current/active normative 문서입니다.`);
      }
    }
  }

  return { errors, documents };
}

function main() {
  const result = validateDocumentation();
  if (result.errors.length > 0) {
    process.stderr.write(`문서 검증 실패 (${result.errors.length}건)\n${result.errors.map((error) => `- ${error}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`문서 검증 통과: ${result.documents.length}개 Markdown 문서\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
