import {
  CAMPUS_NAMES,
  DECORATIVE_EDGE_REGEX,
  HUMAN_NAME_REGEX,
  ROLE_PRIORITY,
  TRAILING_NUMERIC_ALIAS_REGEX,
} from "./constants.ts";

export function normalizeFullWidthBrackets(value: string) {
  return value
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/［/g, "[")
    .replace(/］/g, "]")
    .replace(/【/g, "[")
    .replace(/】/g, "]");
}

export function normalizeNicknameText(value: string) {
  return normalizeFullWidthBrackets(value)
    .replace(/\s+/g, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu, "")
    .replace(DECORATIVE_EDGE_REGEX, "");
}

export function stripTrailingNumericAlias(value: string) {
  return value.replace(TRAILING_NUMERIC_ALIAS_REGEX, "");
}

export function stripMetadataTail(value: string) {
  return value.replace(/\s*(?:\[[^\]]+\]|\([^)]+\)).*$/, "").trim() || value;
}

export function removeTrailingRoleToken(value: string) {
  let current = value.trim();
  let changed = true;

  while (changed) {
    changed = false;

    for (const token of ROLE_PRIORITY.map((item) => item.token)) {
      if (current.endsWith(token)) {
        current = current.slice(0, -token.length).replace(/[_\s-]+$/u, "").trim();
        changed = true;
        break;
      }
    }
  }

  return current;
}

export function extractPersonLikeName(value: string) {
  const trimmed = stripTrailingNumericAlias(value).trim();
  if (!trimmed) {
    return undefined;
  }
  const match = trimmed.match(/^([가-힣]{2,4})(\d*)/u);
  const candidate = match?.[1];
  if (!candidate) {
    return undefined;
  }
  const suffix = trimmed.slice(match[0].length);
  if (suffix && !/^[\[\]\(\)_.\-/,]/u.test(suffix)) {
    return undefined;
  }
  if (CAMPUS_NAMES.some((campus) => candidate.includes(campus))) {
    return undefined;
  }
  if (ROLE_PRIORITY.some((item) => candidate.includes(item.token))) {
    return undefined;
  }
  return candidate;
}

export function isPersonLikeName(value: string) {
  const candidate = extractPersonLikeName(value);
  return Boolean(candidate && HUMAN_NAME_REGEX.test(candidate));
}
