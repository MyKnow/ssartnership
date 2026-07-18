import type { NotificationTemplateDefinition } from "./catalog";

const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const MAX_TITLE_LENGTH = 2_000;
const MAX_BODY_LENGTH = 20_000;

export function extractTemplateVariables(value: string) {
  const variables: string[] = [];
  for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1];
    if (name && !variables.includes(name)) {
      variables.push(name);
    }
  }
  return variables;
}
export function validateNotificationTemplate(
  definition: NotificationTemplateDefinition,
  titleTemplate: string,
  bodyTemplate: string,
) {
  const title = titleTemplate.trim();
  const body = bodyTemplate.trim();
  if (!title || !body) {
    throw new Error("알림 제목과 내용을 모두 입력해 주세요.");
  }
  if (title.length > MAX_TITLE_LENGTH || body.length > MAX_BODY_LENGTH) {
    throw new Error("알림 템플릿이 허용된 길이를 초과했습니다.");
  }

  const availableVariables = new Set(definition.variables.map((item) => item.name));
  const usedVariables = extractTemplateVariables(`${title}\n${body}`);
  const unknownVariables = usedVariables.filter((name) => !availableVariables.has(name));
  if (unknownVariables.length > 0) {
    throw new Error(`허용되지 않은 변수입니다: ${unknownVariables.map((name) => `{${name}}`).join(", ")}`);
  }

  const missingVariables = definition.requiredVariables.filter(
    (name) => !usedVariables.includes(name),
  );
  if (missingVariables.length > 0) {
    throw new Error(`필수 변수가 누락되었습니다: ${missingVariables.map((name) => `{${name}}`).join(", ")}`);
  }

  return { title, body, usedVariables };
}

export function classifyNotificationTemplateOverride(
  definition: NotificationTemplateDefinition,
  titleTemplate: string,
  bodyTemplate: string,
) {
  try {
    validateNotificationTemplate(definition, titleTemplate, bodyTemplate);
    return { valid: true, error: null } as const;
  } catch {
    return {
      valid: false,
      error: "기존 사용자 지정 문구가 현재 변수 계약과 맞지 않습니다.",
    } as const;
  }
}

export function renderNotificationTemplate(
  value: string,
  variables: Record<string, string | number | null | undefined>,
) {
  const missingVariables: string[] = [];
  const rendered = value.replace(PLACEHOLDER_PATTERN, (_match, name: string) => {
    const variable = variables[name];
    if (variable === null || variable === undefined) {
      missingVariables.push(name);
      return "";
    }
    return String(variable);
  });

  if (missingVariables.length > 0) {
    throw new Error(`필수 변수가 누락되었습니다: ${missingVariables.map((name) => `{${name}}`).join(", ")}`);
  }
  return rendered;
}
