import type { NotificationTemplateVariable } from "./catalog";
import { renderNotificationTemplate } from "./template";

export const NOTIFICATION_TEMPLATE_SAMPLE_ERROR =
  "샘플 값을 완성할 수 없습니다. 필수 변수 계약을 확인해 주세요.";

/** 관리자 미리보기용 예시 값. 변수 정의의 example이 없으면 라벨로 만든다. */
export function getNotificationTemplateSampleValues(
  variables: readonly NotificationTemplateVariable[],
) {
  return Object.fromEntries(
    variables.map((variable) => [
      variable.name,
      variable.example ?? `${variable.label} 예시`,
    ]),
  );
}

/** 예시 값으로 템플릿을 렌더한다. 필수 변수가 비면 null. */
export function renderNotificationTemplateSample(
  template: string,
  variables: readonly NotificationTemplateVariable[],
) {
  try {
    return renderNotificationTemplate(
      template,
      getNotificationTemplateSampleValues(variables),
    );
  } catch {
    return null;
  }
}
